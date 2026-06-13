# tests

One pipeline over one set of fixtures (`fixtures.ts`):

```
fixtures.ts -> run_fixtures(resolve) -> transport -> replay (cassette) -> snapshot
```

The committed cassettes plus their snapshots are the source of truth. Tests are
offline and deterministic; hitting live platforms is a deliberate maintainer
step (`record`), never part of the everyday run.

```sh
bun run test            # offline gate: replay cassettes, assert snapshots
bun run test:update     # accept intentional snapshot changes
bun run eval [platform] # human-readable dump of every fixture's media + meta
bun run record [platform]  # refresh cassettes from live platforms (maintainers)
```

## The two signals

- **"our parser broke"** -> `bun run test`. Replays frozen cassette bytes and
  compares each fixture's normalized result against its snapshot. The `.snap`
  diff is the reviewable artifact for any parser change. Fast, no network, no
  credentials. This is the CI gate.
- **"the platform changed its API"** -> `bun run record [platform]`. Hits live
  through the residential proxy and rewrites cassettes. Re-run `bun run test`
  afterward: the snapshot diff shows exactly what moved on the platform side.

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
2. `bun run test`: the snapshot diff shows exactly what moved.
3. If intended, `bun run test:update` and commit the `.snap` diff with the code.
   The diff is the reviewable artifact.

For a human-readable dump of every fixture's media and metadata, use
`bun run eval [platform]`.

## Recording (maintainers)

`bun run record [platform]` re-records through a proxy (needed to avoid rate
limits / IP flagging when hitting the same platforms repeatedly). It only goes
live on a cassette miss, so delete a cassette to force its re-fetch. Configure
`EVAL_PROXY_URL=http://user:pass@host:port`, or a repo-root `.env` with
`GEONODE_USERNAME` / `GEONODE_PASSWORD` (the `record` script loads it via
`--env-file=.env`). Each run pins one sticky residential exit so a multi-request
flow looks like one user.

Reddit is the exception: its `loid` cookie-prime works on a direct connection
but the residential exits are 403-blocked, so Reddit must be recorded without
the proxy.
