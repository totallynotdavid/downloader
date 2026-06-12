// Human-facing run over the fixtures (replay, offline). Prints media counts,
// types, and every populated meta field so a change's effect is visible at a
// glance. For pass/fail gating use `bun test tests/replay` instead.
//
//   bun run eval            every fixture
//   bun run eval youtube    one platform

import { run_fixtures } from "../tests/support/runner.ts";
import { install } from "../tests/support/transport.ts";

const filter = process.argv.slice(2).find((a) => !a.startsWith("--"));

const META_FIELDS = [
  "title",
  "author",
  "description",
  "thumbnail",
  "views",
  "likes",
  "comments",
  "shares",
  "timestamp",
  "reposts",
  "quoteTweet",
];

function summarize_meta(meta: Record<string, unknown>): string {
  return META_FIELDS.filter((k) => meta[k] !== undefined)
    .map((k) => {
      const v = meta[k];
      if (typeof v === "string") {
        const s = v.replace(/\s+/g, " ");
        return `${k}=${s.length > 36 ? `${s.slice(0, 36)}...` : s}`;
      }
      if (typeof v === "object") return `${k}=<obj>`;
      return `${k}=${v}`;
    })
    .join(" ");
}

const uninstall = install({ mode: "replay" });
for (const o of await run_fixtures(filter)) {
  if (o.ok && o.result) {
    const types = o.result.urls.map((u) => u.type).join(",");
    console.log(
      `OK   ${o.label.padEnd(34)} ${String(o.result.urls.length).padStart(2)}[${types}] ${o.ms}ms`,
    );
    console.log(`     ${summarize_meta(o.result.meta)}`);
  } else {
    console.log(
      `FAIL ${o.label.padEnd(34)} ${o.error?.name}: ${o.error?.message} [${o.reqs}]`,
    );
  }
}
uninstall();
