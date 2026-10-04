import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

// The cassette directory is fixed when the transport module loads, so the
// recorder runs in a child process pointed at a temporary directory.
const SCRIPT = `
  globalThis.fetch = async () =>
    new Response("{}", {
      headers: [
        ["content-type", "application/json"],
        ["set-cookie", "csrftoken=secret; Path=/"],
        ["set-cookie", "mid=secret; Path=/"],
      ],
    });
  const { install_record } = await import("${join(import.meta.dir, "..", "support", "transport.ts")}");
  install_record();
  await fetch("https://www.instagram.com/api/graphql", { method: "POST", body: "a" });
  await fetch("https://www.reddit.com/", { method: "GET" });
`;

function recorded(dir: string, host: string) {
  const [file] = readdirSync(join(dir, host));
  return JSON.parse(
    gunzipSync(readFileSync(join(dir, host, file as string))).toString(),
  );
}

test("recording drops Set-Cookie unless the extractor reads it", () => {
  const dir = mkdtempSync(join(tmpdir(), "cassettes-"));
  try {
    const run = Bun.spawnSync(["bun", "-e", SCRIPT], {
      env: { ...process.env, EVAL_CASSETTES: dir, EVAL_PROXY_URL: "direct" },
    });
    expect(run.exitCode).toBe(0);

    const instagram = recorded(dir, "instagram.com");
    expect(instagram.set_cookies).toEqual([]);
    expect(JSON.stringify(instagram.headers)).not.toMatch(/cookie|secret/i);

    const reddit = recorded(dir, "reddit.com");
    expect(reddit.set_cookies).toHaveLength(2);
    expect(Object.keys(reddit.headers)).not.toContain("set-cookie");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
