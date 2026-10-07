# Errors

`resolve` and `listInstagramPosts` can reject with one of the four error classes
exported from the package root. Their implementations are in
[`src/errors.ts`](../src/errors.ts).

```text
Error
├── PlatformNotSupportedError
├── NetworkError            statusCode?: number
│   └── BlockedError
└── ParseError              platform: string
```

| Class                       | Meaning                                       | Extra field           |
| --------------------------- | --------------------------------------------- | --------------------- |
| `PlatformNotSupportedError` | No extractor matches the URL hostname.        |                       |
| `NetworkError`              | A request failed or the target was not found. | `statusCode?: number` |
| `BlockedError`              | Instagram refused anonymous access.           | `statusCode?: number` |
| `ParseError`                | The URL or response could not be interpreted. | `platform: string`    |

`BlockedError` extends `NetworkError`. Check it before `NetworkError` when the
response matters.

A string that is not a URL rejects with the `TypeError` thrown by `new URL`. The
library does not wrap that error.

## Network errors

`NetworkError.statusCode` is set when the server answered with a non-2xx status.
A timeout uses status `408`. A failure before a response, such as a DNS error,
has no status. Instagram uses status `404` for a missing post or account.

Instagram uses `BlockedError` for redirects to login, login-required responses,
rate limits, and posts hidden from logged-out visitors. Other platforms report
an HTTP refusal as `NetworkError`.

## Parse errors

`ParseError.message` starts with `[<platform>]`, and `platform` contains that
platform name. An extractor uses it when the URL lacks an identifier, the
response has an unexpected shape, or no media is available. YouTube also uses it
when the video is not playable.

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
    console.error(`Unsupported platform: ${error.message}`);
  } else if (error instanceof BlockedError) {
    // Change the runtime's network path or stop retrying.
  } else if (error instanceof NetworkError) {
    // Inspect error.statusCode when it is present.
  } else if (error instanceof ParseError) {
    // The post is unusable, or the extractor needs an update.
  } else {
    throw error;
  }
}
```
