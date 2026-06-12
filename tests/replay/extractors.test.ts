// Offline regression suite. Replays committed cassettes and snapshots each
// fixture's normalized result. Deterministic, no network, no proxy, no creds.
//
//   bun test tests/replay                      run the gate
//   bun test tests/replay --update-snapshots   accept current output as golden
//
// Snapshots are strict (frozen cassette in, exact result out), unlike the live
// tests/extractors suite which asserts loosely because live data drifts. Do not
// run both suites in one `bun test` call: this file installs a fetch
// interceptor for the process and the live suite needs the real network.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SAMPLES } from "../fixtures.ts";
import { type Outcome, run_fixtures } from "../support/runner.ts";
import { install } from "../support/transport.ts";

// Skipped until reliable cassettes can be recorded. Reddit proxy exits return
// 403, and the Facebook share/v short URL needs redirect handling.
const PENDING = new Set([
  "reddit/video",
  "reddit/gallery",
  "reddit/single_image",
  "reddit/post_with_thumbnail",
  "facebook/video_short_url",
]);

const results = new Map<string, Outcome>();
let uninstall: () => void;

beforeAll(async () => {
  uninstall = install({ mode: "replay" });
  for (const outcome of await run_fixtures())
    results.set(outcome.label, outcome);
});

afterAll(() => uninstall?.());

for (const [platform, cases] of Object.entries(SAMPLES)) {
  describe(platform, () => {
    for (const name of Object.keys(cases)) {
      const label = `${platform}/${name}`;
      const run = PENDING.has(label) ? test.skip : test;
      run(name, () => {
        const outcome = results.get(label);
        expect(outcome, `no run output for ${label}`).toBeDefined();
        const { ok, result, error } = outcome as Outcome;
        expect({ ok, result, error }).toMatchSnapshot();
      });
    }
  });
}
