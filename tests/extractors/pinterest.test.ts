import { describe, test } from "bun:test";
import { resolve } from "../../src/index.ts";
import { SAMPLES } from "../fixtures.ts";
import { assertMedia } from "../utils.ts";

describe("Pinterest extractor", () => {
  test("should resolve single image", async () => {
    const result = await resolve(SAMPLES.pinterest.single_image);
    assertMedia(result, {
      platform: "pinterest",
      count: 1,
      type: "image",
    });
  }, 30_000);

  test("should resolve video", async () => {
    const result = await resolve(SAMPLES.pinterest.video);
    assertMedia(result, {
      platform: "pinterest",
      count: 1,
      type: "video",
    });
  }, 30_000);
});
