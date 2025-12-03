# @totallynotdavid/downloader

[![npm version](https://img.shields.io/npm/v/@totallynotdavid/downloader.svg)](https://www.npmjs.com/package/@totallynotdavid/downloader)

Direct URLs from social posts. Skip reverse-engineering and heavy tools. 14 KB,
fast, TypeScript-first. Supports Instagram, TikTok, Twitter/X, YouTube, Reddit,
Facebook, Imgur, and Pinterest.

```sh
npm install @totallynotdavid/downloader
```

```typescript
import { resolve } from "@totallynotdavid/downloader";

const result = await resolve("https://www.instagram.com/p/ABC123/");
```

`result.urls[0].url` is the direct media URL. `result.urls[0].filename` is a
suggested filename. `result.meta` contains post metadata like author and title.

Some platforms require headers to download. Pass `result.headers` when fetching:

```typescript
const response = await fetch(result.urls[0].url, {
  headers: result.headers,
});
```

## Reference

<details>
<summary>Options</summary>

```typescript
await resolve(url, {
  timeout: 15000,
  headers: {
    "User-Agent": "...",
  },
});
```

Default timeout is 10 seconds.

</details>

<details>
<summary>Errors</summary>

- `PlatformNotSupportedError`: URL hostname not recognized
- `NetworkError`: request failed (timeout, DNS, HTTP error)
- `ParseError`: platform response changed, extractor needs update

```typescript
import {
  resolve,
  PlatformNotSupportedError,
  NetworkError,
  ParseError,
} from "@totallynotdavid/downloader";
```

</details>

<details>
<summary>Types</summary>

```typescript
type MediaResult = {
  urls: MediaItem[];
  headers: Record<string, string>;
  meta: {
    title: string;
    author: string;
    platform: string;
    views?: number;
    likes?: number;
  };
};

type MediaItem = {
  type: "image" | "video" | "audio";
  url: string;
  filename: string;
};

type ResolveOptions = {
  timeout?: number;
  headers?: Record<string, string>;
};
```

</details>

## License

MIT
