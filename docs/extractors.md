# Writing an extractor

An extractor turns one platform's post URL into a `MediaResult`. Each platform
has a module in [`src/extractors/`](../src/extractors/), and
[`src/router.ts`](../src/router.ts) selects one by hostname.

```text
resolve(url) -> route(url) -> extractor(url, options) -> MediaResult
```

## Add an extractor

1. Create `src/extractors/<platform>.ts`.
2. Register each supported hostname in `src/router.ts`.
3. Add fixtures and cassettes. See [Tests and cassettes](./testing.md).
4. Add the URL forms to [Using the library](./usage.md#supported-urls).

## Extractor shape

An extractor default-exports a function that accepts the URL and
`ResolveOptions`.

```typescript
import { http_get } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaResult, ResolveOptions } from "../types.ts";

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  const id = url.match(/\/post\/(\d+)/)?.[1];
  if (!id) throw new ParseError("Could not parse post id", "example");

  try {
    const response = await http_get(
      `https://api.example.com/posts/${id}`,
      options,
    );
    const data = (await response.json()) as {
      video_url?: string;
      title?: string;
      author?: string;
    };

    if (!data.video_url) throw new ParseError("No media found", "example");

    return {
      urls: [
        { type: "video", url: data.video_url, filename: `example-${id}.mp4` },
      ],
      headers: {},
      meta: {
        title: data.title || "Example post",
        author: data.author || "Unknown",
        platform: "example",
      },
    };
  } catch (error: unknown) {
    if (error instanceof NetworkError || error instanceof ParseError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new ParseError(message, "example");
  }
}
```

Register the extractor with the hostname written without `www.`. The router
removes that prefix before it looks up the hostname.

```typescript
import example from "./extractors/example.ts";

const EXTRACTORS = new Map<string, ExtractorFn>([
  // ...
  ["example.com", example],
  ["ex.am", example],
]);
```

## Contracts

- Use `http_get` and `http_post` from [`src/http.ts`](../src/http.ts). Pass
  `options` through so the caller's timeout and headers apply.
- Throw `ParseError` with the platform name when the URL or response is not
  usable. Rethrow `NetworkError` and `ParseError`; wrap other errors in a
  `ParseError`.
- Put CDN request headers in `result.headers`. Use `{}` when no headers are
  required.
- Use `<platform>-<id>.<ext>` filenames. Add `-1`, `-2` for additional media,
  and `-video` or `-audio` for separate tracks. Facebook uses the `fb-` prefix.
- Assign optional metadata only when the platform returned a value. The
  `exactOptionalPropertyTypes` setting does not allow `undefined` values in
  optional fields.
- Keep platform extractors independent. The Instagram modules share their
  GraphQL client and media parser.

Code style is in [Contributing](../.github/CONTRIBUTING.md#code-style).
