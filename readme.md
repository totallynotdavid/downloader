# [pkg]: @totallynotdavid/downloader

[![npm version](https://img.shields.io/npm/v/@totallynotdavid/downloader.svg)](https://www.npmjs.com/package/@totallynotdavid/downloader)

Library for resolving social media URLs to direct media links and metadata.
Returns downloadable URLs, filenames, and post information.

## Installation

```bash
npm install @totallynotdavid/downloader
```

The library has only two dependencies: `axios` and `cheerio`.

## Quick start

Pass a public post URL to get back media URLs and metadata:

```typescript
import { resolve } from "@totallynotdavid/downloader";

const result = await resolve("https://www.instagram.com/p/DDVjCs0PqAW/");

console.log(result.urls[0].url);
console.log(result.meta.title);
```

The result contains an array of media items with direct download URLs, along
with post metadata like title, author, and engagement metrics.

## Platform support

Direct extraction means the library fetches media URLs itself. Third-party
platforms use external services:

| Platform  | Method      | Status |
| --------- | ----------- | ------ |
| Instagram | Direct      | ✅     |
| TikTok    | Direct      | ✅     |
| Facebook  | Direct      | ✅     |
| Reddit    | Direct      | ✅     |
| Imgur     | Direct      | ✅     |
| YouTube   | Third-party | ✅     |
| Twitter/X | Third-party | WIP    |
| Pinterest | Third-party | ✅     |

## API

### resolve

Resolves a social media URL to media links and metadata:

```typescript
resolve(url: string, options?: ResolveOptions): Promise<MediaResult>
```

Options accepts proxy URL and timeout in milliseconds. Timeout defaults to
10000ms:

```typescript
const result = await resolve(url, {
  proxy: "http://proxy.example.com:8080",
  timeout: 15000,
});
```

Returns a MediaResult with three fields:

1. The urls array contains media items with type, direct URL, suggested
   filename, and optional headers.
2. The headers object contains request headers used for fetching.
3. The meta object includes title, author, platform name, and optional view and
   like counts:

   ```typescript
   type MediaResult = {
     urls: MediaItem[];
     headers: Record<string, string>;
     meta: {
       title: string;
       author: string;
       platform: Platform;
       views?: number;
       likes?: number;
     };
   };

   type MediaItem = {
     type: "image" | "video" | "audio";
     url: string;
     filename: string;
     headers?: Record<string, string>;
   };
   ```

### open_stream

Creates a readable stream for downloading a media item:

```typescript
open_stream(
  item: MediaItem,
  globalHeaders?: Record<string, string>
): Promise<Readable>
```

The function merges global headers with item-specific headers and returns a
Node.js Readable stream. Useful for piping directly to files or responses:

```typescript
import { open_stream } from "@totallynotdavid/downloader";
import { createWriteStream } from "fs";

const stream = await open_stream(result.urls[0], result.headers);
stream.pipe(createWriteStream("output.mp4"));
```

## Error handling

The library throws typed errors for different failure modes:

```typescript
import {
  PlatformNotSupportedError,
  ExtractionError,
  NetworkError,
} from "@totallynotdavid/downloader";

try {
  const result = await resolve(url);
} catch (error) {
  if (error instanceof PlatformNotSupportedError) {
    // URL platform not supported
  } else if (error instanceof ExtractionError) {
    // Failed to extract media, includes platform name
  } else if (error instanceof NetworkError) {
    // Network request failed
  }
}
```

## License

MIT
