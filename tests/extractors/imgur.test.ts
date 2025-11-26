import { describe, test } from "bun:test";
import { resolve } from "../../src/index";
import { SAMPLES } from "../fixtures";
import { assertMedia } from "../utils";

describe("Imgur extractor", () => {
  test("should resolve single image", async () => {
    const result = await resolve(SAMPLES.imgur.single_image);
    assertMedia(result, {
      platform: "imgur",
      count: 1,
      type: "image",
    });
  }, 30_000);

  test("should resolve gallery with single image", async () => {
    const result = await resolve(SAMPLES.imgur.gallery_single_image);
    assertMedia(result, {
      platform: "imgur",
      count: 1,
      type: "image",
    });
  }, 30_000);

  test("should resolve gallery with single video", async () => {
    const result = await resolve(SAMPLES.imgur.gallery_single_video);
    assertMedia(result, {
      platform: "imgur",
      count: 1,
      type: "video",
    });
  }, 30_000);

  test("should resolve gallery with multiple images", async () => {
    const result = await resolve(SAMPLES.imgur.gallery_multi_image);
    assertMedia(result, {
      platform: "imgur",
      minCount: 2,
      type: "image",
    });
  }, 30_000);
});
