# tests

Two suites over one set of fixtures (`fixtures.ts`):

- **`extractors/`**: live integration. Hits real platforms, asserts loosely
  (`assertMedia`: count / type / platform) because live data drifts. Catches
  "the platform changed its API". Slow, flaky, network-bound.
- **`replay/`**: offline regression. Replays committed cassettes and snapshots
  the normalized result exactly. Catches "our parser broke". Deterministic, no
  network, no credentials.

```sh
bun run test            # live suite (tests/extractors)
bun run test:replay     # offline gate (tests/replay)
```

Do not run `bun test` with no path: it would load both suites in one process,
and the replay suite installs a `fetch` interceptor the live suite must not see.

## How replay works

`support/transport.ts` intercepts `globalThis.fetch`. In replay it serves
recordings from `cassettes/<host>/<method>-<hash>.json.gz`; a miss returns a
synthetic 504 so a missing recording is loud, never silently fetched. Media and
thumbnail URLs are normalized (signed CDN query params stripped) before
snapshotting so they stay stable (`normalize` in `utils.ts`).

```
fixtures -> resolve() -> src/http.ts -> fetch -> transport
                                                 |- replay: read cassette (0 network)
                                                 |- record: proxy -> live -> write cassette
```

## Reviewing a parser change

1. Make the change.
2. `bun run test:replay`: the snapshot diff shows exactly what moved.
3. If intended, `bun run test:replay:update` and commit the `.snap` diff with
   the code. The diff is the reviewable artifact.

For a human-readable dump of every fixture's media + metadata, use
`bun run eval [platform]`.

## Recording (maintainers)

`bun run record [platform]` re-records through a proxy (needed to avoid rate
limits / IP flagging when hitting the same platforms repeatedly). Configure
`EVAL_PROXY_URL=http://user:pass@host:port`, or a repo-root `.env` with
`GEONODE_USERNAME` / `GEONODE_PASSWORD`. Each run pins one sticky residential
exit so a multi-request flow looks like one user. Delete a cassette to force its
re-fetch.
