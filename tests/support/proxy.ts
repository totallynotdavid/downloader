// Proxy resolution for record mode only. Replay never touches the network, so
// the regression suite and most eval runs need no proxy and no credentials.
//
// Precedence:
//   1. EVAL_PROXY_URL: full "http://user:pass@host:port" (preferred, explicit)
//   2. .env at the repo root with GEONODE_USERNAME/PASSWORD (or USERNAME/PASSWORD)
//      -> assembled into the Geonode residential gateway.
// Returns undefined when nothing is configured; record then goes out directly.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const GEONODE_HOST = process.env.EVAL_PROXY_HOST ?? "proxy.geonode.io";

// Ports 9000-9010 each map to a different residential exit IP. One sticky exit
// is chosen per process so a multi-request extraction flow looks like one user.
const STICKY_PORT =
  Number(process.env.EVAL_PROXY_PORT) || 9000 + Math.floor(Math.random() * 11);

function read_env_creds(): { user: string; pass: string } | undefined {
  const env_path = join(import.meta.dir, "..", "..", ".env");
  if (!existsSync(env_path)) return undefined;
  const vars: Record<string, string> = {};
  for (const line of readFileSync(env_path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m?.[1] && m[2] !== undefined) vars[m[1]] = m[2].trim();
  }
  const user = vars.GEONODE_USERNAME ?? vars.USERNAME;
  const pass = vars.GEONODE_PASSWORD ?? vars.PASSWORD;
  return user && pass ? { user, pass } : undefined;
}

export function proxy_url(): string | undefined {
  if (process.env.EVAL_PROXY_URL) return process.env.EVAL_PROXY_URL;
  const creds = read_env_creds();
  if (!creds) return undefined;
  return `http://${creds.user}:${creds.pass}@${GEONODE_HOST}:${STICKY_PORT}`;
}

export function proxy_label(): string {
  const url = proxy_url();
  if (!url) return "DIRECT (no proxy configured)";
  // Never print credentials.
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "80"}`;
  } catch {
    return "configured";
  }
}
