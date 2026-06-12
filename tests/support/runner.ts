// Runs resolve() over every fixture and returns normalized outcomes.
// Assumes a transport is already installed (replay or record) by the caller.

import { resolve } from "../../src/resolve.ts";
import { SAMPLES } from "../fixtures.ts";
import { normalize, type NormalizedResult } from "../utils.ts";
import { net_log } from "./transport.ts";

export type Outcome = {
  label: string;
  url: string;
  ok: boolean;
  result?: NormalizedResult;
  error?: { name: string; message: string };
  reqs: string; // request trace, e.g. "cassette,cassette"
  ms: number;
};

export async function run_fixtures(filter?: string): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  for (const [platform, cases] of Object.entries(SAMPLES)) {
    if (filter && platform !== filter) continue;
    for (const [name, url] of Object.entries(cases)) {
      const before = net_log.length;
      const t0 = Date.now();
      try {
        const result = await resolve(url, { timeout: 45_000 });
        outcomes.push({
          label: `${platform}/${name}`,
          url,
          ok: true,
          result: normalize(result),
          reqs: net_log
            .slice(before)
            .map((l) => l.source)
            .join(","),
          ms: Date.now() - t0,
        });
      } catch (e) {
        const err = e as Error;
        outcomes.push({
          label: `${platform}/${name}`,
          url,
          ok: false,
          error: { name: err.constructor.name, message: err.message },
          reqs: net_log
            .slice(before)
            .map((l) => `${l.source}:${l.status}`)
            .join(","),
          ms: Date.now() - t0,
        });
      }
    }
  }
  return outcomes;
}
