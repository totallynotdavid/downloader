import { expect } from "bun:test";
import type { MediaResult } from "../src/types.ts";

type AssertionOptions = {
  platform: string;
  count?: number;
  minCount?: number;
  type?: "video" | "image";
};

export function assertMedia(result: MediaResult, opts: AssertionOptions) {
  expect(result).toBeDefined();
  expect(result.meta.platform).toBe(opts.platform);
  expect(result.meta.title).toBeString();
  expect(result.meta.title.length).toBeGreaterThan(0);

  expect(result.headers).toBeObject();

  if (opts.count) {
    expect(result.urls.length).toBe(opts.count);
  } else if (opts.minCount) {
    expect(result.urls.length).toBeGreaterThanOrEqual(opts.minCount);
  } else {
    expect(result.urls.length).toBeGreaterThan(0);
  }

  result.urls.forEach((item) => {
    expect(item.url).toBeString();
    expect(item.url.startsWith("http")).toBe(true);
    expect(item.filename).toBeString();

    if (opts.type) {
      expect(item.type).toBe(opts.type);
    }
  });
}

// Replay snapshots compare asset identity, not signed CDN params. Keep origin
// and pathname, which identify the asset, and drop expiring query params.
function strip_query(u: string): string {
  try {
    const parsed = new URL(u);
    return `${parsed.origin}${parsed.pathname}`;
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
  if (typeof meta.thumbnail === "string") {
    meta.thumbnail = strip_query(meta.thumbnail);
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
