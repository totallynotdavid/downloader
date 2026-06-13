// The regression suite. Replays committed cassettes and snapshots each
// fixture's normalized result. Deterministic, no network, no proxy, no creds.
//
// Snapshots are strict: frozen cassette bytes in, exact result out, so the
// .snap diff is the reviewable artifact for any parser change. Live drift is
// caught separately by `bun run record` (see tests/readme.md).

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SAMPLES } from "../fixtures.ts";
import { type Outcome, run_fixtures } from "../support/runner.ts";
import { install_replay } from "../support/transport.ts";

const results = new Map<string, Outcome>();
let uninstall: () => void;

beforeAll(async () => {
  uninstall = install_replay();
  for (const outcome of await run_fixtures())
    results.set(outcome.label, outcome);
});

afterAll(() => uninstall?.());

for (const [platform, cases] of Object.entries(SAMPLES)) {
  describe(platform, () => {
    for (const name of Object.keys(cases)) {
      const label = `${platform}/${name}`;
      test(name, () => {
        const outcome = results.get(label);
        expect(outcome, `no run output for ${label}`).toBeDefined();
        const { ok, result, error } = outcome as Outcome;
        expect({ ok, result, error }).toMatchSnapshot();
      });
    }
  });
}
