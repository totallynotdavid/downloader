# Tests and cassettes

The replay tests run every extractor against recorded responses. `bun run test`
does not contact a platform. Recording is the separate workflow that refreshes
those responses from live platforms.

```text
tests/fixtures.ts -> runner -> transport -> cassette -> snapshot
```

## Commands

| Command                     | Purpose                                                                         |
| --------------------------- | ------------------------------------------------------------------------------- |
| `bun run test`              | Replay cassettes and assert snapshots.                                          |
| `bun run test:update`       | Accept intended snapshot changes.                                               |
| `bun run record [platform]` | Refresh cassettes from a live platform.                                         |
| `bun run eval [platform]`   | Print fixture results. See [Live eval](./eval.md).                              |
| `bun run eval:live`         | Check the Instagram fixtures against the live site. See [Live eval](./eval.md). |

The optional platform filters for `record` and `eval` match the keys in
[`tests/fixtures.ts`](../tests/fixtures.ts). The test command runs the files in
[`tests/replay/`](../tests/replay/).

## Review a parser change

1. Change the extractor.
2. Run `bun run test`.
3. Read the snapshot diff.
4. If the change is intended, run `bun run test:update`.

The snapshot is the review artifact. Replay separates a parser change from a
platform response change.

## Fixtures

[`tests/fixtures.ts`](../tests/fixtures.ts) holds two fixture sets:

- `SAMPLES` maps each platform to named post URLs.
- `ACCOUNTS` maps Instagram accounts to page counts and optional detail mode.

Add a post to `SAMPLES`, or an account to `ACCOUNTS`, before recording it. Then
run `bun run record <platform>`, inspect the result with
`bun run eval <platform>`, and run `bun run test:update` when the snapshot is
correct.

## Replay transport

[`tests/support/transport.ts`](../tests/support/transport.ts) replaces
`globalThis.fetch` in replay and record modes.

```text
extractor -> src/http.ts -> fetch -> transport
                                     |- replay: read a cassette, no network
                                     |- record: fetch live data, write a cassette
```

A cassette is `tests/cassettes/<host>/<method>-<hash>.json.gz`. The hash uses
the method, URL, and request body, so changing a request body misses the old
cassette. Replay returns a synthetic 504 for a missing cassette instead of
fetching it.

Recording keeps `Set-Cookie` only for Reddit because its extractor reads the
anonymous priming cookie. Snapshots remove query strings so signed CDN
parameters do not create noise.

## Record

Recording requires either `EVAL_PROXY_URL` or Geonode credentials. The first
matching setting wins:

| Setting                                     | Effect                                                           |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `EVAL_PROXY_URL=http://user:pass@host:port` | Use that proxy.                                                  |
| `EVAL_PROXY_URL=direct`                     | Record without a proxy when the host has a clean residential IP. |
| `GEONODE_USERNAME` and `GEONODE_PASSWORD`   | Use the Geonode residential gateway.                             |

The `record` script loads a repository-root `.env` file. It chooses one sticky
residential exit for the process. Reddit is recorded directly because its
cookie-priming request rejects the residential exits.

Without a proxy setting, recording stops before its first request:

```text
$ bun run record
error: GEONODE_USERNAME is required for this command. Set it in .env or the environment.
```

## Inspect a cassette

A cassette is gzipped JSON. The response body is base64 in `body_b64`.

```sh
zcat tests/cassettes/api.vxtwitter.com/GET-56a35b1c45644f82.json.gz \
  | jq -r .body_b64 | base64 -d | jq '{tweetID, mediaURLs}'
```
