# Tests and cassettes

The tests run every extractor offline against recorded responses. Nothing
touches a platform during `bun run test`. Hitting a live platform is a
maintainer step called recording.

```text
tests/fixtures.ts -> run_fixtures(resolve) -> transport -> cassette -> snapshot
```

The committed cassettes and snapshots are the source of truth.

## Commands

| Command                     | What it does                                              |
| --------------------------- | --------------------------------------------------------- |
| `bun run test`              | Replays cassettes and asserts the snapshots. The CI gate  |
| `bun run test:update`       | Accepts intended snapshot changes                         |
| `bun run record [platform]` | Refreshes cassettes from the live platforms               |
| `bun run eval [platform]`   | Prints every fixture's result. See [Live eval](./eval.md) |
| `bun run eval:live`         | Checks Instagram live. See [Live eval](./eval.md)         |

`bun run test` runs `bun test tests/replay`. To run one file, pass part of its
name: `bun test instagram`.

## Two signals

- **Our parser broke.** `bun run test` replays frozen bytes and compares each
  result with its snapshot. The `.snap` diff is the reviewable artifact for a
  parser change. It needs no network and no credentials.
- **The platform changed.** Record again, then run `bun run test`. The snapshot
  diff shows what moved on the platform side.

## Fixtures

[`tests/fixtures.ts`](../tests/fixtures.ts) holds the inputs.

- `SAMPLES` maps a platform name to named post URLs. Each one is resolved.
- `ACCOUNTS` maps `instagram` to named accounts. Each one lists `pages` pages of
  posts, and `detail: true` resolves every post on them.

The platform name is the filter argument of `record` and `eval`.

## The test files

All three are in [`tests/replay/`](../tests/replay/).

| File                 | Covers                                                                    |
| -------------------- | ------------------------------------------------------------------------- |
| `extractors.test.ts` | One snapshot per `SAMPLES` entry                                          |
| `instagram.test.ts`  | Account listing from cassettes, and the typed errors from stubbed `fetch` |
| `recorder.test.ts`   | That recording drops `Set-Cookie` unless an extractor reads it            |

Instagram's failure modes cannot be summoned on demand from a live host. The
failure tests in `instagram.test.ts` answer `fetch` with the response shapes
Instagram sends.

## How replay works

[`tests/support/transport.ts`](../tests/support/transport.ts) replaces
`globalThis.fetch`.

```text
extractor -> src/http.ts -> fetch -> transport
                                     |- replay: read the cassette, no network
                                     |- record: send through the proxy, write the cassette
```

- A cassette is `tests/cassettes/<host>/<method>-<hash>.json.gz`. The host drops
  a leading `www.`. The hash is the first 16 hex digits of SHA-256 over the
  method, the URL and the request body.
- Because the body is in the key, a changed `doc_id` or variable set misses the
  old cassette.
- Replay answers a missing cassette with a synthetic 504. A missing recording
  fails loudly. It is never fetched.
- Recording drops `Set-Cookie` for every host except `reddit.com`, because the
  Reddit extractor reads its anonymous priming cookie.
- Snapshots keep each URL's origin and path and drop the query. That removes
  signed CDN parameters, which change on every recording. `itag` and `mime` stay
  because YouTube streams differ only by them. See `normalize` in
  [`tests/utils.ts`](../tests/utils.ts).

## Review a parser change

1. Make the change.
2. Run `bun run test`. The snapshot diff shows what moved.
3. If the diff is intended, run `bun run test:update` and commit the `.snap`
   change with the code.

## Add a fixture

1. Add the URL to `SAMPLES`, or an account to `ACCOUNTS`.
2. Run `bun run record <platform>`. See [Record](#record).
3. Run `bun run test:update` and read the new snapshot.
4. Commit the cassettes and the snapshot together.

## Record

`bun run record [platform]` resolves every fixture of the platform, or of all
platforms, and writes a cassette for each request. It goes live only when no
cassette matches the request. To force a fresh fetch, delete the cassette. The
command does not remove cassettes that no fixture reads any more.

Recording needs a proxy, because repeated requests from one IP get rate limited
or flagged. Without one, it exits with an error:

```text
$ bun run record
error: GEONODE_USERNAME is required for this command. Set it in .env or the environment.
```

Choose one of these. The first match wins.

| Setting                                     | Effect                               |
| ------------------------------------------- | ------------------------------------ |
| `EVAL_PROXY_URL=http://user:pass@host:port` | Uses that proxy                      |
| `EVAL_PROXY_URL=direct`                     | Records without a proxy              |
| `GEONODE_USERNAME` and `GEONODE_PASSWORD`   | Uses the Geonode residential gateway |

- `bun run record` loads a repo-root `.env` with `--env-file=.env`. `.env` is
  ignored by git.
- Each run pins one sticky residential exit, so a multi-request flow looks like
  one user.
- `direct` suits a host whose own IP is not flagged. Instagram answers anonymous
  requests from such a host and blocks datacenter IPs.
- Reddit hosts are always recorded without the proxy. Reddit serves its
  cookie-primed JSON to a direct connection and blocks the residential exits.

The proxy code is in [`tests/support/proxy.ts`](../tests/support/proxy.ts).

## Inspect a cassette

A cassette is gzipped JSON. The response body is base64 in `body_b64`.

```sh
zcat tests/cassettes/api.vxtwitter.com/GET-56a35b1c45644f82.json.gz \
  | jq -r .body_b64 | base64 -d | jq '{tweetID, mediaURLs}'
```
