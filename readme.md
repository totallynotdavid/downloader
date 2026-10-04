# [pkg]: @totallynotdavid/downloader

[![NPM Version](https://img.shields.io/npm/v/@totallynotdavid/downloader?logo=npm&logoColor=212121&label=version&labelColor=ffc44e&color=212121)](https://www.npmjs.com/package/@totallynotdavid/downloader)
[![codecov](https://codecov.io/gh/totallynotdavid/downloader/graph/badge.svg?token=8OBBAZG8MN)](https://codecov.io/gh/totallynotdavid/downloader)

Direct URLs from social posts. Skip reverse-engineering and heavy tools.
Supports Instagram, TikTok, Twitter/X, YouTube, Reddit, Facebook, Imgur, and
Pinterest.

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

## Instagram accounts

List an account's recent public posts, 12 per page, newest first. No login.

```typescript
import { listInstagramPosts } from "@totallynotdavid/downloader";

let page = await listInstagramPosts("instagram");
for (const post of page.posts) console.log(post.shortcode, post.author);

if (page.cursor)
  page = await listInstagramPosts("instagram", { cursor: page.cursor });
```

Each post has `shortcode`, `url`, `author`, `caption`, `type` (`image`, `video`
or `carousel`) and `thumbnail`. `author` is the post's first author, so a collab
post on this account's grid can name another account.

The grid carries no media URLs or timestamp. Pass `detail: true` to fill `media`
(full resolution, same items as `resolve`) and `timestamp` (unix seconds). It
costs one extra request per post.

Instagram blocks datacenter IPs far more often than residential ones. From a
server, expect `BlockedError` and route requests through a residential proxy.

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
- `NetworkError`: request failed (timeout, DNS, HTTP error, not found)
- `BlockedError`: a `NetworkError` for when the platform refuses anonymous
  access: redirect to login, rate limit, IP block, or a login-only post
- `ParseError`: platform response changed or came back empty, extractor needs
  update

```typescript
import {
  resolve,
  PlatformNotSupportedError,
  NetworkError,
  BlockedError,
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
