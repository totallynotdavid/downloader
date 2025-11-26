import { describe, test } from "bun:test";
import { resolve } from "../../src/index";
import { SAMPLES } from "../fixtures";
import { assertMedia } from "../utils";

describe("Instagram extractor", () => {
  test("should resolve video (reel)", async () => {
    const result = await resolve(SAMPLES.instagram.video_reel);
    assertMedia(result, {
      platform: "instagram",
      count: 1,
      type: "video",
    });
  }, 30_000);

  test("should resolve carousel (multiple items)", async () => {
    const result = await resolve(SAMPLES.instagram.carousel);
    assertMedia(result, {
      platform: "instagram",
      minCount: 2,
    });
  }, 30_000);

  test("should resolve single image", async () => {
    const result = await resolve(SAMPLES.instagram.single_image);
    assertMedia(result, {
      platform: "instagram",
      count: 1,
      type: "image",
    });
  }, 30_000);
});
