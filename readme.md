# @totallynotdavid/downloader

`@totallynotdavid/downloader` is a TypeScript library for applications that need
direct media URLs from public social posts. Pass a post URL to `resolve`, then
fetch the returned media with the returned headers. The library parses public
responses; it does not download files, log in, or run a browser.

## Install

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

`result.urls` contains the media. `result.headers` contains headers required by
the media host. `result.meta` contains the post metadata.

The supported platform URL forms are listed in
[Using the library](docs/usage.md). Instagram account listing is available
through `listInstagramPosts`.

## Documentation

- [Using the library](docs/usage.md) covers the result, options, and supported
  URL forms.
- [Instagram](docs/instagram.md) covers post resolution and account listing.
- [Errors](docs/errors.md) covers the exported error classes.
- [Architecture](architecture.md) maps the source modules and request path.

[Contributing](.github/CONTRIBUTING.md) covers local setup and checks.

## License

MIT
