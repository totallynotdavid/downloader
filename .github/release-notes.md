@totallynotdavid/downloader 1.2.0 is out.

It has been four months since 1.1.0. This is an additive release with one fix
you will notice: Instagram post resolution works again.

Instagram's old Android-style query now answers 401, so `resolve` failed for
every Instagram post. It now uses the logged-out web query, which needs no login
and returns the exact post timestamp. Redirects are no longer followed on that
path, so a redirect to the login page is reported as an error instead of being
parsed as HTML.

The new `listInstagramPosts(username, options?)` returns a page of up to 12
posts from an account in grid order, with a `cursor` for the next page. The
profile grid carries no media URLs, so `detail: true` resolves each post and
fills `media` and `timestamp`. It costs one extra request per post and is off by
default to spare the rate limit. The `ListPostsOptions`, `Post` and `PostPage`
types are exported with it.

A new `BlockedError` extends `NetworkError`. Instagram throws it when it refuses
anonymous access, such as a redirect to the login page. Code that catches
`NetworkError` keeps working. Check for `BlockedError` first if you want to tell
a block from other network failures.

The rest is internal cleanup, tests and docs. The documentation is now split
into one page per subject under `docs/`.

## Known problems

Instagram can block anonymous requests from datacenter IPs. Retrying from the
same IP rarely helps. Use a residential proxy; `docs/instagram.md` explains how.

## What to do

Upgrade with `npm install @totallynotdavid/downloader@1.2.0`. No code changes
are needed. If you resolve Instagram posts, run one before you deploy. Report
problems at https://github.com/totallynotdavid/downloader/issues.
