import { describe, test } from "bun:test";
import { resolve } from "../../src/index";
import { SAMPLES } from "../fixtures";
import { assertMedia } from "../utils";

describe("TikTok extractor", () => {
  test("should resolve video", async () => {
    const result = await resolve(SAMPLES.tiktok.video);
    assertMedia(result, {
      platform: "tiktok",
      count: 1,
      type: "video",
    });
  }, 30_000);

  test("should resolve carousel (multiple images)", async () => {
    const result = await resolve(SAMPLES.tiktok.carousel);
    assertMedia(result, {
      platform: "tiktok",
      minCount: 2,
      type: "image",
    });
  }, 30_000);
});
