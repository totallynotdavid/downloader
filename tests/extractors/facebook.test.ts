import { describe, test } from "bun:test";
import { resolve } from "../../src/index.ts";
import { SAMPLES } from "../fixtures.ts";
import { assertMedia } from "../utils.ts";

// Facebook returns 2 URLs (video and audio separately)
describe("Facebook extractor", () => {
  test("should resolve video", async () => {
    const result = await resolve(SAMPLES.facebook.video);
    assertMedia(result, {
      platform: "facebook",
      count: 2,
    });
  }, 30_000);

  test("should resolve video (short URL)", async () => {
    const result = await resolve(SAMPLES.facebook.video_short_url);
    assertMedia(result, {
      platform: "facebook",
      count: 2,
    });
  }, 30_000);
});
