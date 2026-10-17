import type { MediaResult, Post } from "../src/types.ts";

// Snapshots drop signed CDN query params, which change on every re-record.
// googlevideo streams share one /videoplayback path and differ only by itag
// and mime, so those two keys stay.
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

export function normalize_post(post: Post): Post {
  const out: Post = { ...post, thumbnail: strip_query(post.thumbnail) };
  if (post.media) {
    out.media = post.media.map((m) => ({ ...m, url: strip_query(m.url) }));
  }
  return out;
}
