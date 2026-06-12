// Refresh cassettes from live platforms through the proxy. Only maintainers run
// this, and only when a platform changes; everyday work uses replay.
//
//   bun run record            re-record every fixture
//   bun run record tiktok     just one platform
//
// Needs a proxy to avoid rate limits / IP flagging when re-recording the same
// platforms repeatedly. Configure either:
//   EVAL_PROXY_URL=http://user:pass@host:port
//   or a repo-root .env with GEONODE_USERNAME / GEONODE_PASSWORD
// Without one, requests go out directly. Existing cassettes are reused; delete a
// cassette file to force its re-fetch.

import { run_fixtures } from "../tests/support/runner.ts";
import { install, net_log } from "../tests/support/transport.ts";

const filter = process.argv.slice(2).find((a) => !a.startsWith("--"));

const uninstall = install({ mode: "record" });
const outcomes = await run_fixtures(filter);
uninstall();

const recorded = net_log.filter((l) => l.source === "network").length;
const reused = net_log.filter((l) => l.source === "cassette").length;
for (const o of outcomes) {
  const status = o.ok ? "ok" : `${o.error?.name}: ${o.error?.message}`;
  console.log(
    `${o.ok ? "OK  " : "FAIL"} ${o.label.padEnd(34)} ${status} [${o.reqs}]`,
  );
}
console.log(
  `\nrecorded ${recorded} new request(s), reused ${reused} cassette(s)`,
);
