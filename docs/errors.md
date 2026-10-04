# Errors

`resolve` and `listInstagramPosts` reject with one of four error classes. All
four are exported from the package. The source is
[`src/errors.ts`](../src/errors.ts).

```text
Error
├── PlatformNotSupportedError
├── NetworkError            statusCode?: number
│   └── BlockedError
└── ParseError              platform: string
```

| Class                       | Meaning                                    | Extra field           |
| --------------------------- | ------------------------------------------ | --------------------- |
| `PlatformNotSupportedError` | The hostname has no extractor.             |                       |
| `NetworkError`              | A request failed or the target is missing. | `statusCode?: number` |
| `BlockedError`              | The platform refused anonymous access.     | `statusCode?: number` |
| `ParseError`                | The input or the response was not usable.  | `platform: string`    |

`BlockedError` extends `NetworkError`. An `instanceof NetworkError` check also
matches it, so test for `BlockedError` first.

A string that is not a URL rejects with the `TypeError` that `new URL` throws.
No class wraps it.

## When each error is thrown

**`PlatformNotSupportedError`**: `resolve` finds no extractor for the hostname.
The message is `No extractor found for URL: <url>`.

**`NetworkError`**:

- The server answered with a non-2xx status. `statusCode` holds it.
- The request timed out. `statusCode` is `408` and the message is
  `Request timeout`.
- The request failed before any response, such as a DNS error. `statusCode` is
  unset.
- Instagram reports that a post or account does not exist. `statusCode` is
  `404`.

**`BlockedError`**: only Instagram throws it. The cases are:

| Case                                                    | `statusCode` |
| ------------------------------------------------------- | ------------ |
| The API answered with a 302, 401, 403 or 429            | The status   |
| The API response says the request needs a login         | 401          |
| The API response carries the rate limit error code      | 429          |
| A post exists but is not visible to logged-out visitors | 401          |

Other platforms that refuse a request, such as a 403 from Reddit, throw a plain
`NetworkError`. See [Instagram](./instagram.md) for what to do about a block.

**`ParseError`**: the message starts with `[<platform>]`, and `platform` holds
the name.

- The URL has no post id the extractor can read.
- The response is empty, is not JSON, or no longer has the expected shape.
- The response has no media.
- YouTube reports the video as not playable. The message is YouTube's reason.
- Any error that is not already a `NetworkError` or `ParseError` is wrapped as a
  `ParseError` by the extractor that caught it.

For Instagram, a `ParseError` whose message says the query id may be stale means
the web query the library sends has expired. That is a library fix. See
[Live eval](./eval.md).

## Handling errors

```typescript
import {
  resolve,
  BlockedError,
  NetworkError,
  ParseError,
  PlatformNotSupportedError,
} from "@totallynotdavid/downloader";

try {
  await resolve(url);
} catch (error) {
  if (error instanceof PlatformNotSupportedError) {
    // Not a supported hostname.
  } else if (error instanceof BlockedError) {
    // Change the IP or give up. Retrying from the same IP rarely helps.
  } else if (error instanceof NetworkError) {
    // error.statusCode is 404 for a missing post, 408 for a timeout.
  } else if (error instanceof ParseError) {
    // The post is unusable, or the extractor needs an update.
  } else {
    throw error;
  }
}
```
