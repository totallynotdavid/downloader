import { describe, test } from "bun:test";
import { resolve } from "../../src/index.ts";
import { SAMPLES } from "../fixtures.ts";
import { assertMedia } from "../utils.ts";

describe("YouTube extractor", () => {
  test("should resolve video", async () => {
    const result = await resolve(SAMPLES.youtube.video);
    assertMedia(result, {
      platform: "youtube",
      count: 1,
      type: "video",
    });
  }, 30_000);

  test("should resolve video (shorts)", async () => {
    const result = await resolve(SAMPLES.youtube.video_short);
    assertMedia(result, {
      platform: "youtube",
      count: 3, // combined + video-only + audio-only
    });
  }, 30_000);
});
