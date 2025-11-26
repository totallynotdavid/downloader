import { expect } from "bun:test";
import type { MediaResult, Platform } from "../src/types.ts";

type AssertionOptions = {
  platform: Platform;
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

  // Gallery/item count
  if (opts.count) {
    expect(result.urls.length).toBe(opts.count);
  } else if (opts.minCount) {
    expect(result.urls.length).toBeGreaterThanOrEqual(opts.minCount);
  } else {
    expect(result.urls.length).toBeGreaterThan(0);
  }

  // Item integrity
  result.urls.forEach((item) => {
    expect(item.url).toBeString();
    expect(item.url.startsWith("http")).toBe(true);
    expect(item.filename).toBeString();

    if (opts.type) {
      expect(item.type).toBe(opts.type);
    }

    // Check optional item headers if they exist
    if (item.headers) {
      expect(item.headers).toBeObject();
    }
  });
}
