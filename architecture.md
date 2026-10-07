# Architecture

The package accepts a public post URL and returns a normalized `MediaResult`.
The public entry points are exported from [`src/index.ts`](src/index.ts).

## Request path

```text
resolve(url, options)
  -> route(url)
  -> platform extractor
  -> http_get/http_post
  -> global fetch
  -> MediaResult
```

[`src/resolve.ts`](src/resolve.ts) selects an extractor through
[`src/router.ts`](src/router.ts). The router removes a leading `www.` and
matches the hostname. Pinterest also accepts subdomains. An unmatched hostname
produces `PlatformNotSupportedError`.

The extractor parses the platform response into the common types in
[`src/types.ts`](src/types.ts). [`src/http.ts`](src/http.ts) supplies default
request headers, applies the per-request timeout, and turns failed HTTP
responses into `NetworkError`.

## Source map

| Path                         | Responsibility                                                     |
| ---------------------------- | ------------------------------------------------------------------ |
| `src/index.ts`               | Public functions, types, and error exports.                        |
| `src/resolve.ts`             | Resolves one post through the router.                              |
| `src/router.ts`              | Maps supported hostnames to extractors.                            |
| `src/http.ts`                | GET and POST wrappers around `fetch`.                              |
| `src/errors.ts`              | Public error classes.                                              |
| `src/types.ts`               | Public result, media, and Instagram listing types.                 |
| `src/extractors/*.ts`        | Platform-specific URL parsing, requests, and response mapping.     |
| `scripts/eval.ts`            | Prints fixture results for local inspection.                       |
| `tests/fixtures.ts`          | Post and account inputs used by replay tests and eval.             |
| `tests/support/transport.ts` | Replays or records HTTP responses for tests.                       |
| `tests/replay/`              | Behavioral tests for extractors, Instagram listing, and recording. |

## Instagram listing

[`src/extractors/instagram-posts.ts`](src/extractors/instagram-posts.ts) uses
the Instagram extractor's shared media lookup for `detail: true`. It validates
the username before the first request, returns pages of up to 12 posts, and uses
the returned cursor for later pages.

## Build boundary

[`bunup.config.ts`](bunup.config.ts) builds `src/index.ts` into `dist/index.js`
and `dist/index.d.ts`. The package publishes `dist`, `readme.md`, and `LICENSE`,
as declared in [`package.json`](package.json).
