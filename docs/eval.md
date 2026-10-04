# Live eval

[`scripts/eval.ts`](../scripts/eval.ts) runs every fixture and prints what each
one returned. It has two modes.

| Command                   | Mode                                                    |
| ------------------------- | ------------------------------------------------------- |
| `bun run eval [platform]` | Replays the committed cassettes. No network             |
| `bun run eval:live`       | Sends real requests to Instagram and fails on any error |

`bun run eval:live` is `bun scripts/eval.ts --live instagram`. The platform
argument works with `--live` too, for example `--live youtube`.

## Read the output

Each post fixture prints two lines: its status with the item count, item types
and time, then its metadata.

```text
OK   instagram/single_image              1[image] 241ms
     title=¡Continuamos con la segunda charla d... author=gft.unmsm ...
```

Each account fixture prints one line per page set, then one line per post with
its shortcode, type, author, timestamp, item count and caption.

```text
OK   instagram/images                   gft.unmsm 12 posts, more 1335ms
     DcepzLhTqxC  image    gft.unmsm        2026-08-25T21:56:15.000Z media=1 ¡Continuamos con la segunda charla d
```

A failed fixture prints `FAIL`, the error class and its message.

```text
FAIL instagram/video_reel               NetworkError: Unable to connect. Is the computer able to access the url? []
```

## Exit code

`bun run eval` always exits 0, so read its `FAIL` lines. `bun run eval:live`
counts the `FAIL` lines. If there are any, it prints `N live check(s) failed`
and exits 1.

## Check for a stale Instagram query

Instagram retires the persisted query ids the library sends. See
[Instagram](./instagram.md#anonymous-query). `bun run eval:live` is the check.
It runs every Instagram post and account fixture against the live site. A
retired id fails with a `ParseError` that says the query id may be stale.

`eval:live` sends no proxy settings. From a datacenter IP, expect
`BlockedError`, which does not mean the ids are stale. Set `HTTPS_PROXY` as
[Instagram](./instagram.md#blocking-and-datacenter-ips) describes, or run it
from a residential connection.

The check makes one request per fixture post, and an account fixture with
`detail: true` adds one request per listed post. It is a maintainer check. CI
does not run it.
