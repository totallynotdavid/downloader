# Using the library

`resolve(url, options?)` returns direct media URLs, the headers needed to fetch
them, and metadata for one public post. It does not download the media.

```typescript
import { resolve } from "@totallynotdavid/downloader";

const result = await resolve("https://www.instagram.com/p/DcepzLhTqxC/");
console.log(result.meta.author, result.urls.length);
```

## The result

The public types are declared in [`src/types.ts`](../src/types.ts).

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

`title`, `author`, and `platform` are always present. Other metadata fields are
present only when the platform returns them. `timestamp` is Unix time in
seconds. `filename` is a suggested name, not a guarantee about the media format.

A post can return more than one item. Galleries and carousels return one item
per image. Facebook can return separate video and audio items. YouTube can
return separate video-only and audio-only items when no single stream has the
best video quality.

## Download the media

Pass `result.headers` to each media request.

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

## Options

```typescript
await resolve(url, {
  timeout: 15_000,
  headers: { "Accept-Language": "es-PE" },
});
```

| Option    | Meaning                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `timeout` | Milliseconds allowed for each request. The default is 10,000. YouTube uses 15,000 for its requests when no value is supplied. |
| `headers` | Additional request headers. Extractors that require an app-specific user agent may override it.                               |

Some posts require several requests. `timeout` applies to each request, not to
the complete `resolve` call.

## Supported URLs

The router removes a leading `www.` and matches the remaining hostname. It also
accepts any Pinterest subdomain. Other hostnames must match the table.

| Platform  | Hostnames                          | URL examples                                                             |
| --------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Instagram | `instagram.com`                    | `/p/<code>/`, `/reel/<code>/`, `/tv/<code>/`                             |
| TikTok    | `tiktok.com`                       | `/@user/video/<id>`, `/@user/photo/<id>`                                 |
| Twitter/X | `twitter.com`, `x.com`             | `/<user>/status/<id>`                                                    |
| YouTube   | `youtube.com`, `youtu.be`          | `/watch?v=<id>`, `/shorts/<id>`, `/embed/<id>`, or a `youtu.be/<id>` URL |
| Reddit    | `reddit.com`, `redd.it`            | A post permalink                                                         |
| Facebook  | `facebook.com`, `fb.com`           | A video, photo, or share URL                                             |
| Imgur     | `imgur.com`, `i.imgur.com`         | An image, album, or gallery URL                                          |
| Pinterest | `pinterest.com`, `*.pinterest.com` | `/pin/<id>/` or `/pin/<slug>--<id>/`                                     |

`resolve` accepts a post URL, not an account URL. Use
[`listInstagramPosts`](./instagram.md#list-an-accounts-posts) for Instagram
account pages.

## Request failures

The call can reject with a `TypeError` for an invalid URL, or with one of the
exported error classes. See [Errors](./errors.md) for handling them.
