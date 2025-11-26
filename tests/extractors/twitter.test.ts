import { describe, test } from "bun:test";
import { resolve } from "../../src/index";
import { SAMPLES } from "../fixtures";
import { assertMedia } from "../utils";

describe("Twitter extractor", () => {
  test("should resolve multi-image tweet", async () => {
    const result = await resolve(SAMPLES.twitter.multi_image);
    assertMedia(result, {
      platform: "twitter",
      minCount: 2,
      type: "image",
    });
  }, 30_000);

  test("should resolve video tweet", async () => {
    const result = await resolve(SAMPLES.twitter.video);
    assertMedia(result, {
      platform: "twitter",
      count: 1,
      type: "video",
    });
  }, 30_000);
});
