import { afterAll, beforeAll, expect, test } from "bun:test";
import { resolve } from "../../src/index.ts";
import { install_replay } from "../support/transport.ts";

let uninstall: () => void;

beforeAll(() => {
  uninstall = install_replay();
});

afterAll(() => uninstall?.());

test("a share link with a query and a fragment resolves the post", async () => {
  const result = await resolve(
    "https://www.reddit.com/r/interestingasfuck/comments/1drzauu/the_chinese_tianlong3_rocket_accidentally/?utm_source=share&utm_medium=web#comments",
  );
  expect(result.urls[0]?.filename).toBe("reddit-1drzauu.mp4");
});
