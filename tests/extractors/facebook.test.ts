import { describe, test } from "bun:test";
import { resolve } from "../../src/index";
import { SAMPLES } from "../fixtures";
import { assertMedia } from "../utils";

describe("Facebook extractor", () => {
  test("should resolve video", async () => {
    const result = await resolve(SAMPLES.facebook.video);
    assertMedia(result, {
      platform: "facebook",
      count: 1,
      type: "video",
    });
  }, 30_000);

  test("should resolve video (short URL)", async () => {
    const result = await resolve(SAMPLES.facebook.video_short_url);
    assertMedia(result, {
      platform: "facebook",
      count: 1,
      type: "video",
    });
  }, 30_000);
});
