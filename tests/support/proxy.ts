// Proxy resolution is only called by record mode. Replay must not touch the
// network.
//
// Precedence:
//   1. EVAL_PROXY_URL: full "http://user:pass@host:port" (explicit, wins).
//   2. GEONODE_USERNAME/PASSWORD -> assembled into the Geonode residential
//      gateway at a sticky exit port.
// Recording without either is a hard error: a direct exit gets rate-limited and
// IP-flagged, which would only produce poisoned cassettes.

import { env } from "./env.ts";

// Ports 9000-9010 each map to a different residential exit IP. One sticky exit
// is chosen per process so a multi-request extraction flow looks like one user.
const STICKY_PORT = 9000 + Math.floor(Math.random() * 11);

export function resolve_proxy(): string {
  if (env.proxyUrl) return env.proxyUrl;
  const user = env.geonodeUser();
  const pass = env.geonodePassword();
  return `http://${user}:${pass}@proxy.geonode.io:${STICKY_PORT}`;
}

// host:port only, so the record log never prints credentials.
export function redact(proxyUrl: string): string {
  const u = new URL(proxyUrl);
  return `${u.hostname}:${u.port || "80"}`;
}
