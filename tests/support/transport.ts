// VCR-style record/replay transport, installed over globalThis.fetch.
//
// Every extractor request goes through src/http.ts, which calls the global
// fetch. Installing an interceptor there lets the whole library run offline
// against committed cassettes, so a change can be re-tested with byte-identical
// inputs and zero network exposure.
//
//   replay (default): serve from cassettes/. A miss returns a synthetic
//                     504 so a missing recording is loud, never silently
//                     re-fetched.
//   record (RECORD=1 or mode:"record"): misses go live through one sticky
//                     residential proxy exit, then the raw response is saved.
//
// install() returns an uninstall function; callers own the lifecycle so the
// interceptor never leaks into the live test suite.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { proxy_label, proxy_url } from "./proxy.ts";

const CASSETTE_DIR =
  process.env.EVAL_CASSETTES ?? join(import.meta.dir, "..", "cassettes");

export type Mode = "replay" | "record";

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
  body_b64: string;
  recorded_at: string;
};

// content-encoding/length describe the on-the-wire bytes; we store the decoded
// body, so replaying these headers would corrupt text()/json(). Drop them.
const VOLATILE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
]);

function strip_headers(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (!VOLATILE_HEADERS.has(k.toLowerCase())) out[k] = v;
  }
  return out;
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

function request_url(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function make_fetch(mode: Mode, real_fetch: typeof fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = request_url(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? String(init.body) : "";
    const path = cassette_path(url, method, body);

    if (existsSync(path)) {
      const rec = read_cassette(path);
      net_log.push({ method, url, source: "cassette", status: rec.status });
      return new Response(Buffer.from(rec.body_b64, "base64"), {
        status: rec.status,
        statusText: rec.status_text,
        headers: strip_headers(rec.headers),
      });
    }

    if (mode === "replay") {
      net_log.push({ method, url, source: "miss", status: 504 });
      return new Response(`[cassette miss] ${method} ${url}`, {
        status: 504,
        statusText: "Cassette miss (run with RECORD=1 to capture)",
      });
    }

    const res = await real_fetch(url, {
      ...init,
      // @ts-expect-error Bun-specific proxy option
      proxy: proxy_url(),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const headers = Object.fromEntries(res.headers.entries());
    write_cassette(path, {
      url,
      final_url: res.url,
      method,
      status: res.status,
      status_text: res.statusText,
      headers,
      body_b64: buf.toString("base64"),
      recorded_at: new Date().toISOString(),
    });
    net_log.push({ method, url, source: "network", status: res.status });
    return new Response(buf, {
      status: res.status,
      statusText: res.statusText,
      headers: strip_headers(headers),
    });
  }) as typeof fetch;
}

export function install(opts: { mode?: Mode } = {}): () => void {
  const mode: Mode =
    opts.mode ?? (process.env.RECORD === "1" ? "record" : "replay");
  const real_fetch = globalThis.fetch;
  globalThis.fetch = make_fetch(mode, real_fetch);
  if (mode === "record") {
    console.error(`[transport] RECORD via ${proxy_label()}`);
  }
  return () => {
    globalThis.fetch = real_fetch;
  };
}
