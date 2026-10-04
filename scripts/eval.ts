// Print fixture output for human review. Replay committed cassettes by default.
// The --live option sends requests to the platforms and exits non-zero on failure.

import { run_fixtures, run_listings } from "../tests/support/runner.ts";
import { install_replay } from "../tests/support/transport.ts";

const args = process.argv.slice(2);
const live = args.includes("--live");
const filter = args.find((a) => !a.startsWith("--"));

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

const uninstall = live ? () => {} : install_replay();
let failures = 0;

for (const o of await run_fixtures(filter)) {
  if (o.ok && o.result) {
    const types = o.result.urls.map((u) => u.type).join(",");
    console.log(
      `OK   ${o.label.padEnd(34)} ${String(o.result.urls.length).padStart(2)}[${types}] ${o.ms}ms`,
    );
    console.log(`     ${summarize_meta(o.result.meta)}`);
  } else {
    failures++;
    console.log(
      `FAIL ${o.label.padEnd(34)} ${o.error?.name}: ${o.error?.message} [${o.reqs}]`,
    );
  }
}

for (const o of await run_listings(filter)) {
  if (o.ok && o.pages) {
    const sizes = o.pages.map((p) => p.length).join("+");
    console.log(
      `OK   ${o.label.padEnd(34)} ${o.username} ${sizes} posts${o.more ? ", more" : ""} ${o.ms}ms`,
    );
    for (const post of o.pages.flat()) {
      const stamp = post.timestamp
        ? new Date(post.timestamp * 1000).toISOString()
        : "-";
      const caption = (post.caption ?? "").replace(/\s+/g, " ").slice(0, 36);
      console.log(
        `     ${post.shortcode.padEnd(12)} ${post.type.padEnd(8)} ${post.author.padEnd(16)} ${stamp} media=${post.media?.length ?? "-"} ${caption}`,
      );
    }
  } else {
    failures++;
    console.log(
      `FAIL ${o.label.padEnd(34)} ${o.error?.name}: ${o.error?.message} [${o.reqs}]`,
    );
  }
}

uninstall();
if (live && failures > 0) {
  console.error(`\n${failures} live check(s) failed`);
  process.exit(1);
}
