# Instagram

The package has two Instagram entry points. `resolve` returns media for one
post. `listInstagramPosts` returns a page of an account's posts. Both use
Instagram's logged-out web endpoint and require no login.

## Resolve a post

`resolve` accepts `/p/<code>/`, `/reel/<code>/`, and `/tv/<code>/` URLs.

```typescript
import { resolve } from "@totallynotdavid/downloader";

const result = await resolve("https://www.instagram.com/p/DcepzLhTqxC/");
```

The result contains the post's media at the first available full-resolution
candidate. A carousel has one item per child. `result.headers` contains the
`User-Agent` and `Referer` needed when fetching Instagram media.

An account URL or a URL without one of the supported post paths rejects with a
`ParseError`.

## List an account's posts

```typescript
import { listInstagramPosts } from "@totallynotdavid/downloader";

const first = await listInstagramPosts("uni_oficial");
for (const post of first.posts) {
  console.log(post.shortcode, post.type, post.author);
}

if (first.cursor) {
  const next = await listInstagramPosts("uni_oficial", {
    cursor: first.cursor,
  });
}
```

`listInstagramPosts(username, options?)` returns up to 12 posts in grid order.
The result type is exported from the package root:

```typescript
type ListPostsOptions = ResolveOptions & {
  cursor?: string;
  detail?: boolean;
};

type Post = {
  shortcode: string;
  url: string;
  author: string;
  caption?: string;
  type: "image" | "video" | "carousel";
  thumbnail: string;
  media?: MediaItem[];
  timestamp?: number;
};

type PostPage = {
  posts: Post[];
  cursor?: string;
};
```

### Username and cursor

A leading `@` is optional. The username that remains must match
`[A-Za-z0-9._]{1,30}`. Invalid usernames and malformed cursors reject before a
request.

Pass `cursor` unchanged to fetch the next page. It is absent on the last page.
An unknown account rejects with a `NetworkError` whose `statusCode` is `404`. An
account with no posts returns `{ posts: [] }`.

`url` is an Instagram reel URL for reels and a post URL for other items.
`author` is the first author returned for that grid item. `caption` is absent
when the post has no caption. `thumbnail` is the cover image URL.

### Detail

The regular account response contains no media URLs or timestamp. Set
`detail: true` to fill `media` with the same items returned by `resolve` and to
fill `timestamp` with Unix seconds. This adds one request per post. A failure
rejects the whole page.

## Anonymous access

Instagram can block anonymous requests from datacenter IPs. A block is reported
as `BlockedError`; retrying from the same IP rarely helps.

The library uses the runtime's global `fetch`. Configure a residential proxy in
the runtime when it supports proxy environment variables. Node 24 or later
requires `NODE_USE_ENV_PROXY=1` for that configuration.

See [Errors](./errors.md) for all Instagram block cases.
