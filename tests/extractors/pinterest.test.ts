import { describe, test } from "bun:test";
import { resolve } from "../../src/index";
import { SAMPLES } from "../fixtures";
import { assertMedia } from "../utils";

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
