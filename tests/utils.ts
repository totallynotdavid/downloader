import type { MediaResult } from "../src/types.ts";

// Replay snapshots compare asset identity, not signed CDN params. Most
// platforms encode identity in the path, so keep origin + pathname and drop the
// query. YouTube is the exception: every googlevideo stream shares the same
// /videoplayback path and carries its format identity (itag, mime) in the
// query, so dropping the whole query would collapse every video/audio stream to
// one indistinguishable URL. Keep those two keys; everything else in the query
// is signed/ephemeral (expire, sig, ip, and the o-... `id` render token) and
// churns on every re-record, so it stays stripped.
const STABLE_QUERY_KEYS = new Set(["itag", "mime"]);

function strip_query(u: string): string {
  try {
    const parsed = new URL(u);
    const kept = [...parsed.searchParams]
      .filter(([key]) => STABLE_QUERY_KEYS.has(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    const base = `${parsed.origin}${parsed.pathname}`;
    return kept ? `${base}?${kept}` : base;
  } catch {
    return u;
  }
}

export type NormalizedResult = {
  urls: Array<{ type: string; filename: string; url: string }>;
  headers: Record<string, string>;
  meta: Record<string, unknown>;
};

export function normalize(result: MediaResult): NormalizedResult {
  const meta: Record<string, unknown> = { ...result.meta };
  if (typeof meta["thumbnail"] === "string") {
    meta["thumbnail"] = strip_query(meta["thumbnail"]);
  }
  return {
    urls: result.urls.map((m) => ({
      type: m.type,
      filename: m.filename,
      url: strip_query(m.url),
    })),
    headers: result.headers,
    meta,
  };
}
