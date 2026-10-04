# Using the library

`resolve` takes a post URL and returns the direct media URLs, the headers needed
to fetch them, and the post's metadata. It makes plain HTTP requests and keeps
no state between calls.

```typescript
import { resolve } from "@totallynotdavid/downloader";

const result = await resolve("https://www.instagram.com/p/DcepzLhTqxC/");
console.log(result.meta.author, result.urls.length);
```

## The result

The types live in [`src/types.ts`](../src/types.ts).

```typescript
type MediaResult = {
  urls: MediaItem[];
  headers: Record<string, string>;
  meta: {
    title: string;
    author: string;
    platform: string;
    description?: string;
    thumbnail?: string;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    reposts?: number;
    timestamp?: number;
  };
};

type MediaItem = {
  type: "image" | "video" | "audio";
  url: string;
  filename: string;
};
```

- `title`, `author` and `platform` are always set.
- The other `meta` fields are set only when the platform returns them.
- `timestamp` is Unix seconds.
- `filename` is a suggested name such as `instagram-DcepzLhTqxC.jpg`.

One post can give several items:

- A gallery or carousel gives one item per image.
- Facebook gives its video track and audio track as separate items.
- YouTube adds a separate video item and audio item when a wider video-only
  stream exists than the combined one. Merge them yourself, for example with
  ffmpeg.

## Download the media

`resolve` does not download anything. Fetch each URL and send `result.headers`.

```typescript
import { writeFile } from "node:fs/promises";
import { resolve } from "@totallynotdavid/downloader";

const result = await resolve("https://www.instagram.com/p/DcepzLhTqxC/");

for (const item of result.urls) {
  const response = await fetch(item.url, { headers: result.headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${item.url}`);
  await writeFile(item.filename, Buffer.from(await response.arrayBuffer()));
}
```

Instagram, TikTok and Facebook return headers. The other platforms return an
empty object.

## Options

```typescript
await resolve(url, {
  timeout: 15000,
  headers: { "Accept-Language": "es-PE" },
});
```

| Option    | Meaning                                                              |
| --------- | -------------------------------------------------------------------- |
| `timeout` | Milliseconds per request. Default 10000. YouTube defaults to 15000.  |
| `headers` | Extra headers for every request the extractor makes. See the caveat. |

An extractor that imitates an app client keeps its own `User-Agent`. YouTube
player requests ignore a `User-Agent` set here.

A post can take several requests. `timeout` applies to each one, not to the
whole call.

## Supported URLs

The router matches the hostname exactly after it drops a leading `www.`. Only
Pinterest also matches subdomains. Any other hostname, including `m.youtube.com`
and `vm.tiktok.com`, rejects with `PlatformNotSupportedError`. The routing table
is [`src/router.ts`](../src/router.ts).

| Platform  | Hostnames                          | URL forms                                                       |
| --------- | ---------------------------------- | --------------------------------------------------------------- |
| Instagram | `instagram.com`                    | `/p/<code>/`, `/reel/<code>/`, `/tv/<code>/`                    |
| TikTok    | `tiktok.com`                       | `/@user/video/<id>`, `/@user/photo/<id>`                        |
| Twitter/X | `twitter.com`, `x.com`             | `/<user>/status/<id>`                                           |
| YouTube   | `youtube.com`, `youtu.be`          | `/watch?v=<id>`, `/shorts/<id>`, `/embed/<id>`, `youtu.be/<id>` |
| Reddit    | `reddit.com`, `redd.it`            | The post permalink                                              |
| Facebook  | `facebook.com`, `fb.com`           | Video, photo and share URLs                                     |
| Imgur     | `imgur.com`, `i.imgur.com`         | `/<id>`, `/a/<id>`, `/gallery/<id>`, `i.imgur.com/<id>.<ext>`   |
| Pinterest | `pinterest.com`, `*.pinterest.com` | `/pin/<id>/`                                                    |

`resolve` takes a post, not an account. An Instagram account URL rejects with a
`ParseError`. To list an account's posts, see [Instagram](./instagram.md).

## Errors

Every failure is one of four error classes, or a `TypeError` for a string that
is not a URL. See [Errors](./errors.md).
