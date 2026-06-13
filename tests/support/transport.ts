// Record/replay transport for extractor tests. Callers own the returned
// uninstall function so the fetch interceptor never leaks into live tests.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { env } from "./env.ts";
import { redact, resolve_proxy } from "./proxy.ts";

const CASSETTE_DIR =
  env.cassetteDir ?? join(import.meta.dir, "..", "cassettes");

type RequestSource = "cassette" | "network" | "miss";

export const net_log: Array<{
  method: string;
  url: string;
  source: RequestSource;
  status: number;
}> = [];

type Cassette = {
  url: string;
  final_url: string;
  method: string;
  status: number;
  status_text: string;
  headers: Record<string, string>;
  set_cookies: string[];
  body_b64: string;
  recorded_at: string;
};

// content-encoding/length describe the on-the-wire bytes; we store the decoded
// body, so replaying these headers would corrupt text()/json(). Drop them.
//
// set-cookie is dropped from the flat map and stored as cassette.set_cookies
// instead: Headers.entries() folds multiple Set-Cookie into one comma-joined
// value, and rebuilding from that collapses getSetCookie() to a single broken
// cookie. Reddit's loid cookie prime depends on getSetCookie() returning each
// cookie intact, so we round-trip them as a list and re-append on replay.
const VOLATILE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "set-cookie",
]);

function strip_headers(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (!VOLATILE_HEADERS.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}

// Rebuild a Response with set-cookie restored as discrete headers so
// getSetCookie() sees each cookie, not one folded value.
function build_response(
  body: Buffer,
  rec: Pick<Cassette, "status" | "status_text" | "headers" | "set_cookies">,
): Response {
  const headers = new Headers(strip_headers(rec.headers));
  for (const cookie of rec.set_cookies ?? [])
    headers.append("set-cookie", cookie);
  return new Response(body, {
    status: rec.status,
    statusText: rec.status_text,
    headers,
  });
}

function cassette_path(url: string, method: string, body: string): string {
  const hash = createHash("sha256")
    .update(`${method}\n${url}\n${body}`)
    .digest("hex")
    .slice(0, 16);
  const host = new URL(url).hostname.replace(/^www\./, "");
  return join(CASSETTE_DIR, host, `${method}-${hash}.json.gz`);
}

function read_cassette(path: string): Cassette {
  return JSON.parse(gunzipSync(readFileSync(path)).toString("utf8"));
}

function write_cassette(path: string, cassette: Cassette): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, gzipSync(Buffer.from(JSON.stringify(cassette))));
}

function request_url(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

type RequestKey = { url: string; method: string; path: string };

function request_key(
  input: string | URL | Request,
  init?: RequestInit,
): RequestKey {
  const url = request_url(input);
  const method = (init?.method ?? "GET").toUpperCase();
  const body = init?.body ? String(init.body) : "";
  return { url, method, path: cassette_path(url, method, body) };
}

// Cassette misses are mode-specific: replay fails loudly, record goes live.
function cassette_hit(key: RequestKey): Response | undefined {
  if (!existsSync(key.path)) return undefined;
  const rec = read_cassette(key.path);
  net_log.push({
    method: key.method,
    url: key.url,
    source: "cassette",
    status: rec.status,
  });
  return build_response(Buffer.from(rec.body_b64, "base64"), rec);
}

function install_fetch(fetch: typeof globalThis.fetch): () => void {
  const real_fetch = globalThis.fetch;
  globalThis.fetch = fetch;
  return () => {
    globalThis.fetch = real_fetch;
  };
}

export function install_replay(): () => void {
  return install_fetch((async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const key = request_key(input, init);
    const hit = cassette_hit(key);
    if (hit) return hit;
    net_log.push({
      method: key.method,
      url: key.url,
      source: "miss",
      status: 504,
    });
    return new Response(`[cassette miss] ${key.method} ${key.url}`, {
      status: 504,
      statusText: "Cassette miss (run `bun run record` to capture)",
    });
  }) as typeof fetch);
}

// Reddit serves its cookie-primed JSON to a direct connection but 403s the
// residential proxy exits, so record reddit hosts direct. Every other platform
// goes through the proxy to avoid rate-limits / IP flagging when hammering the
// same fixtures repeatedly.
const DIRECT_RECORD_HOSTS = ["reddit.com"];

function record_proxy(url: string, proxy: string): string | undefined {
  const host = new URL(url).hostname;
  const direct = DIRECT_RECORD_HOSTS.some(
    (h) => host === h || host.endsWith(`.${h}`),
  );
  return direct ? undefined : proxy;
}

export function install_record(): () => void {
  // Resolve the proxy now so a misconfigured run fails before the first request.
  const proxy = resolve_proxy();
  console.error(`[transport] RECORD via ${redact(proxy)}`);
  const real_fetch = globalThis.fetch;
  return install_fetch((async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const key = request_key(input, init);
    const hit = cassette_hit(key);
    if (hit) return hit;

    // record_proxy returns undefined for direct-record hosts. Omit the proxy
    // key entirely rather than passing proxy: undefined so the request goes
    // direct instead of through the sticky exit.
    const exit = record_proxy(key.url, proxy);
    const res = await real_fetch(key.url, {
      ...init,
      ...(exit ? { proxy: exit } : {}),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const headers = Object.fromEntries(res.headers.entries());
    const set_cookies = res.headers.getSetCookie();
    const rec = {
      status: res.status,
      status_text: res.statusText,
      headers,
      set_cookies,
    };
    write_cassette(key.path, {
      url: key.url,
      final_url: res.url,
      method: key.method,
      body_b64: buf.toString("base64"),
      recorded_at: new Date().toISOString(),
      ...rec,
    });
    net_log.push({
      method: key.method,
      url: key.url,
      source: "network",
      status: res.status,
    });
    return build_response(buf, rec);
  }) as typeof fetch);
}
