// Refresh cassettes from live platforms.

import { run_fixtures } from "../tests/support/runner.ts";
import { install_record, net_log } from "../tests/support/transport.ts";

const filter = process.argv.slice(2).find((a) => !a.startsWith("--"));

const uninstall = install_record();
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
