# [pkg]: @totallynotdavid/downloader

[![NPM Version](https://img.shields.io/npm/v/@totallynotdavid/downloader?logo=npm&logoColor=212121&label=version&labelColor=ffc44e&color=212121)](https://www.npmjs.com/package/@totallynotdavid/downloader)
[![codecov](https://codecov.io/gh/totallynotdavid/downloader/graph/badge.svg?token=8OBBAZG8MN)](https://codecov.io/gh/totallynotdavid/downloader)

Direct media URLs from social posts. Pass a post URL. Get back the URLs of its
images, videos and audio, the headers needed to fetch them, and the post's
metadata. Supports Instagram, TikTok, Twitter/X, YouTube, Reddit, Facebook,
Imgur, and Pinterest.

It makes plain HTTP requests to public endpoints. It does not download files,
log in, or run a browser.

```sh
npm install @totallynotdavid/downloader
```

## Resolve a post

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

`result.urls` holds the media. `result.headers` holds the headers the download
needs. `result.meta` holds the author, title and other post details.

## List an Instagram account

```typescript
import { listInstagramPosts } from "@totallynotdavid/downloader";

const page = await listInstagramPosts("uni_oficial");
for (const post of page.posts) console.log(post.url, post.type);

if (page.cursor) {
  const next = await listInstagramPosts("uni_oficial", { cursor: page.cursor });
}
```

Each page holds up to 12 posts in grid order: newest first, apart from pinned
posts, which come first. Instagram blocks datacenter IPs far more often than
residential ones. From a server, expect `BlockedError`.

## Documentation

- [Using the library](https://github.com/totallynotdavid/downloader/blob/master/docs/usage.md):
  options, the result, and supported URLs.
- [Instagram](https://github.com/totallynotdavid/downloader/blob/master/docs/instagram.md):
  post URLs, account listing, and blocking.
- [Errors](https://github.com/totallynotdavid/downloader/blob/master/docs/errors.md):
  the four error classes.
- [Writing an extractor](https://github.com/totallynotdavid/downloader/blob/master/docs/extractors.md):
  add a platform.
- [Platforms](https://github.com/totallynotdavid/downloader/blob/master/docs/platforms.md):
  what each extractor requests and reads.
- [Tests and cassettes](https://github.com/totallynotdavid/downloader/blob/master/docs/testing.md):
  the offline test workflow.
- [Live eval](https://github.com/totallynotdavid/downloader/blob/master/docs/eval.md):
  check the extractors against live platforms.
- [Contributing](https://github.com/totallynotdavid/downloader/blob/master/.github/CONTRIBUTING.md):
  setup, checks, and commit rules.

The
[documentation index](https://github.com/totallynotdavid/downloader/blob/master/docs/readme.md)
lists every document.

## License

MIT
