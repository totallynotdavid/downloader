# Writing an extractor

An extractor turns one platform's post URL into a `MediaResult`. There is one
file per platform in [`src/extractors/`](../src/extractors/). The router in
[`src/router.ts`](../src/router.ts) picks the extractor by hostname.

```text
resolve(url) -> route(url) -> extractor(url, options) -> MediaResult
```

## Add an extractor

1. Create `src/extractors/<platform>.ts`.
2. Register its hostnames in `src/router.ts`.
3. Add fixtures and record cassettes. See [Tests and cassettes](./testing.md).
4. Document the platform in [Platforms](./platforms.md) and add a row to the
   table in [Using the library](./usage.md#supported-urls).

### The file

An extractor default-exports one function.

```typescript
import { http_get } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaResult, ResolveOptions } from "../types.ts";

const ID_REGEX = /\/post\/(\d+)/;

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  const id = url.match(ID_REGEX)?.[1];
  if (!id) {
    throw new ParseError("Could not parse post id", "example");
  }

  try {
    const response = await http_get(
      `https://api.example.com/posts/${id}`,
      options,
    );
    const data = (await response.json()) as {
      video_url?: string;
      title?: string;
      author?: string;
      likes?: number;
    };

    if (!data.video_url) {
      throw new ParseError("No media found", "example");
    }

    const meta: MediaResult["meta"] = {
      title: data.title || "Example post",
      author: data.author || "Unknown",
      platform: "example",
    };
    if (data.likes !== undefined) meta.likes = data.likes;

    return {
      urls: [
        { type: "video", url: data.video_url, filename: `example-${id}.mp4` },
      ],
      headers: {},
      meta,
    };
  } catch (e: unknown) {
    if (e instanceof NetworkError || e instanceof ParseError) throw e;
    const message = e instanceof Error ? e.message : "Unknown error";
    throw new ParseError(message, "example");
  }
}
```

### The router

Add one entry per hostname to `EXTRACTORS` in
[`src/router.ts`](../src/router.ts). Write the hostname without `www.`, because
the router drops it before the lookup. The sample is an excerpt of that file.
`ExtractorFn` is the type declared there, so it needs no import.
`./extractors/example.ts` is a placeholder for the file you create in the steps
above.

```typescript
import example from "./extractors/example.ts";

const EXTRACTORS = new Map<string, ExtractorFn>([
  // ...
  ["example.com", example],
  ["ex.am", example],
]);
```

## Rules

- **Requests.** Use `http_get` and `http_post` from
  [`src/http.ts`](../src/http.ts). They apply the timeout and a default
  `User-Agent`, and they turn a non-2xx status into a `NetworkError` with
  `statusCode`. Pass `options` through so the caller's `timeout` and `headers`
  apply.
- **Errors.** Throw `ParseError` with the platform name when the URL or the
  response is unusable. Rethrow `NetworkError` and `ParseError` as they are, and
  wrap anything else in a `ParseError`, as the example does. Throw
  `BlockedError` only when the platform refuses anonymous access. See
  [Errors](./errors.md).
- **Filenames.** Use `<platform>-<id>.<ext>`. A post with several items adds an
  index, `-1`, `-2`. Separate tracks use `-video` and `-audio`. Facebook is the
  exception and uses the `fb-` prefix.
- **Headers.** Put the headers the CDN needs for the download in
  `result.headers`. Use an empty object when it needs none.
- **Optional metadata.** The tsconfig sets `exactOptionalPropertyTypes`, so an
  optional field cannot hold `undefined`. Assign each optional `meta` field only
  when the platform returned a value, as the example does with `likes`. The
  field names are in [`src/types.ts`](../src/types.ts).
- **Independence.** An extractor for one platform does not import another
  platform's extractor. Only the Instagram files import each other, because they
  share one API. See [Instagram](./instagram.md).

Code style is in [Contributing](../.github/CONTRIBUTING.md#code-style).
