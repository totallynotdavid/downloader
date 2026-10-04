# Instagram

Instagram has two entry points. `resolve` turns one post URL into media.
`listInstagramPosts` lists an account's recent posts. Both use the same
logged-out web query, need no login, and fail with the same error types.

## Anonymous query

Both functions send a form-encoded `POST` to
`https://www.instagram.com/api/graphql`. The body names a persisted query by
`doc_id` and carries its variables as JSON. The code is in
[`src/extractors/instagram-graphql.ts`](../src/extractors/instagram-graphql.ts).

| Query                | Used by                        | Variables              |
| -------------------- | ------------------------------ | ---------------------- |
| `post`               | `resolve`, and `detail: true`  | `media_id`             |
| `profile_posts`      | the first page of an account   | `username`, `first`    |
| `profile_posts_page` | every later page of an account | `id`, `after`, `first` |

The `doc_id` values are in `QUERIES` in that file. They are the only copy.

- `media_id` is the post's shortcode decoded from Instagram's 64-character
  alphabet into a decimal string.
- The requests carry no cookies. They send fixed `X-CSRFToken`, `X-FB-LSD` and
  `X-IG-App-ID` values and a desktop Chrome `User-Agent`. Instagram accepts any
  token value for a logged-out query, and fixed values keep recorded request
  bodies replayable.
- Requests do not follow redirects. A redirect to the login page becomes a
  `BlockedError`.
- Instagram can prefix a response with `for (;;);`. The code strips it.

Instagram retires `doc_id` values. A retired id makes the call reject with a
`ParseError` whose message says the query id may be stale. The fix is to replace
the id in `QUERIES`, re-record the Instagram cassettes, and run the live check.
See [Tests and cassettes](./testing.md) and [Live eval](./eval.md).

## Resolve a post

`resolve` accepts `/p/<code>/`, `/reel/<code>/` and `/tv/<code>/` URLs.

```typescript
import { resolve } from "@totallynotdavid/downloader";

const result = await resolve("https://www.instagram.com/p/DcepzLhTqxC/");
```

It reads the `post` query's `xig_polaris_media.if_not_gated_logged_out` object.

| Result field       | Source field                                           |
| ------------------ | ------------------------------------------------------ |
| `urls`             | `carousel_media`, or the post itself when it has none  |
| `meta.author`      | `user.username`                                        |
| `meta.title`       | `caption.text`, or `Instagram post` when there is none |
| `meta.description` | `caption.text`                                         |
| `meta.thumbnail`   | `display_uri`                                          |
| `meta.timestamp`   | `taken_at`                                             |
| `meta.likes`       | `like_count`                                           |
| `meta.comments`    | `comment_count`                                        |

Each item is the first entry of `video_versions` when it exists, else the first
entry of `image_versions2.candidates`. Instagram orders candidates by size, so
that is the full-resolution file. Filenames are `instagram-<code>.<ext>`, and a
carousel adds `-1`, `-2` and so on. `headers` holds a `User-Agent` and a
`Referer`. Send them when you fetch the media.

An account URL, or any URL without one of those paths, rejects with a
`ParseError`.

## List an account's posts

```typescript
import { listInstagramPosts } from "@totallynotdavid/downloader";

const first = await listInstagramPosts("uni_oficial");
for (const post of first.posts) {
  console.log(post.shortcode, post.type, post.author);
}

if (first.cursor) {
  const second = await listInstagramPosts("uni_oficial", {
    cursor: first.cursor,
  });
}
```

`listInstagramPosts(username, options?)` returns one page of up to 12 posts in
grid order: newest first, apart from pinned posts, which come first. It is
exported from the package root. The code is in
[`src/extractors/instagram-posts.ts`](../src/extractors/instagram-posts.ts) and
the types in [`src/types.ts`](../src/types.ts).

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

### Username

A leading `@` is dropped. The rest must match `[A-Za-z0-9._]{1,30}`. Anything
else rejects with a `ParseError` before any request.

### Pages and the cursor

- `cursor` is absent on the last page. Pass it back unchanged to get the next
  page.
- The cursor identifies the account. With a `cursor`, `username` is only
  validated, so a cursor from another account lists that account.
- A malformed cursor rejects with a `ParseError` before any request.
- An account with no posts returns `{ posts: [] }`.
- A response that is missing its posts or a required post field rejects with a
  `ParseError`.
- An unknown account rejects with a `NetworkError` whose `statusCode` is 404.

### Post fields

- `url` is `https://www.instagram.com/reel/<code>/` for a reel and
  `https://www.instagram.com/p/<code>/` for everything else.
- `type` is `carousel`, `video` or `image`.
- `author` is the post's first author. A collab post on an account's grid can
  name another account.
- `caption` is absent when the post has none.
- `thumbnail` is a signed CDN URL for the cover image.

### Detail

The grid has no media URLs and no timestamp. With `detail: true`, the library
resolves every post on the page, four at a time, and fills in:

- `media`: the same items `resolve` returns, at full resolution.
- `timestamp`: Unix seconds.

This costs one extra request per post. If any post fails, the whole call
rejects. It returns no partial page.

## Blocking and datacenter IPs

Instagram answers anonymous requests from residential IPs far more often than
from datacenter IPs. From a server, expect `BlockedError`. The error message
says so.

[Errors](./errors.md) lists every case that throws `BlockedError`. Retrying from
the same IP rarely helps.

The library has no proxy option. It calls the global `fetch`, so route traffic
through a residential proxy at the runtime level:

```sh
# Bun
HTTPS_PROXY=http://user:pass@host:port bun app.ts

# Node 24 or later
NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://user:pass@host:port node app.js
```

Without `NODE_USE_ENV_PROXY=1`, Node ignores `HTTPS_PROXY`.

Recording cassettes uses its own proxy settings. See
[Tests and cassettes](./testing.md#record).
