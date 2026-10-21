# Live eval

[`scripts/eval.ts`](../scripts/eval.ts) runs the fixtures and prints each
result. Replay is the default. The `--live` flag sends requests to platforms.

| Command                   | Mode                                                |
| ------------------------- | --------------------------------------------------- |
| `bun run eval [platform]` | Replays committed cassettes without network access. |
| `bun run eval:live`       | Runs the Instagram fixtures against the live site.  |

## Output

Each post fixture prints a status, item count, item types, elapsed time, and
metadata.

```text
OK   instagram/single_image              1[image] 241ms
     title=¡Continuamos con la segunda charla d... author=gft.unmsm ...
```

Each account fixture prints its page sizes and then one line per post.

```text
OK   instagram/images                   gft.unmsm 12 posts, more 1335ms
     DcepzLhTqxC  image    gft.unmsm        2026-08-25T21:56:15.000Z media=1 ¡Continuamos con la segunda charla d
```

A failed fixture prints `FAIL`, the error class, and its message.

```text
FAIL instagram/video_reel               NetworkError: Unable to connect. Is the computer able to access the url? []
```

## Exit status

Replay eval always exits 0, so inspect its `FAIL` lines. Live eval exits 1 when
one or more fixtures fail and prints the count of failed checks.

## Check Instagram queries

Instagram can retire the persisted query IDs used by the library. A retired ID
causes a `ParseError` that says the query ID may be stale. Run
`bun run eval:live` to check the post and account fixtures against Instagram.

The live check does not configure a proxy. From a datacenter IP, a
`BlockedError` means the network path was refused, not that the query IDs are
stale. Configure the runtime's proxy as described in
[Instagram](./instagram.md#anonymous-access), or run the check from a
residential connection.

The check makes one request per post fixture. An account fixture with
`detail: true` adds one request per listed post. CI does not run this live
check.
