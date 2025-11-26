import { describe, test } from "bun:test";
import { resolve } from "../../src/index.ts";
import { SAMPLES } from "../fixtures.ts";
import { assertMedia } from "../utils.ts";

describe("Reddit extractor", () => {
  test("should resolve video", async () => {
    const result = await resolve(SAMPLES.reddit.video);
    assertMedia(result, {
      platform: "reddit",
      count: 1,
      type: "video",
    });
  }, 30_000);

  test("should resolve gallery (multiple images)", async () => {
    const result = await resolve(SAMPLES.reddit.gallery);
    assertMedia(result, {
      platform: "reddit",
      minCount: 2,
      type: "image",
    });
  }, 30_000);

  test("should resolve single image post", async () => {
    const result = await resolve(SAMPLES.reddit.single_image);
    assertMedia(result, {
      platform: "reddit",
      count: 1,
      type: "image",
    });
  }, 30_000);

  test("should resolve post with thumbnail", async () => {
    const result = await resolve(SAMPLES.reddit.post_with_thumbnail);
    assertMedia(result, {
      platform: "reddit",
      count: 1,
    });
  }, 30_000);
});
