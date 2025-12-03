# Instructions

This is a TypeScript library that resolves social media URLs to direct media
download links. It uses Bun as the runtime and test runner.

Our philosophy:

- Simplicity as a scaling strategy (dumb, explicit, predictable components)
- Minimal moving parts
- Maintainability
- Code as documentation (comments should only be used for non-obvious decisions
  or for JSDoc)

## Architecture

```
src/
├── index.ts      # Public exports: resolve(), types, errors
├── resolve.ts    # Main entry point, delegates to router
├── router.ts     # URL → extractor mapping by hostname
├── http.ts       # Shared fetch wrappers with timeout/error handling
├── types.ts      # MediaResult, MediaItem, ResolveOptions
├── errors.ts     # PlatformNotSupportedError, NetworkError, ParseError
└── extractors/   # One file per platform (instagram.ts, reddit.ts, etc.)
```

**Data flow**: `resolve(url)` → `router.route(url)` → platform extractor →
`MediaResult`

Each extractor is a standalone async function that:

1. Parses the URL to extract post ID/shortcode
2. Fetches data (HTML scraping or API calls)
3. Returns `MediaResult` with `urls[]`, `headers`, and `meta`

## Commands

```bash
bun test                    # Run all tests
bun test tests/extractors/instagram.test.ts  # Single platform
bun run build               # Format + bundle to dist/
bun run format              # Biome format + check
```

## Adding a new extractor

1. Create `src/extractors/{platform}.ts` exporting a default async function:

   ```typescript
   export default async function resolve(
     url: string,
     options: ResolveOptions,
   ): Promise<MediaResult>;
   ```

2. Register hostname mappings in [router.ts](../src/router.ts):

   ```typescript
   ["example.com", exampleExtractor],
   ["ex.co", exampleExtractor],  // Short URLs
   ```

3. Add test fixtures in [tests/fixtures.ts](../tests/fixtures.ts) and create
   `tests/extractors/{platform}.test.ts`

## Extractor patterns

**Direct extraction** (Instagram, TikTok, Reddit): Parse HTML or call platform
APIs directly **Third-party APIs** (Twitter via vxtwitter): Proxy through
external services

Common patterns in extractors:

- Use `http_get`/`http_post` from `../http.ts` for requests (handles timeouts,
  errors)
- Throw `ParseError` with platform name for extraction failures
- Re-throw `NetworkError` and `ParseError`, wrap unknown errors in `ParseError`
- Generate filenames as `{platform}-{id}.{ext}` or
  `{platform}-{id}-{index}.{ext}` for galleries
- Include required headers in `result.headers` for downloading (Referer,
  User-Agent)

## Testing conventions

- Tests use real URLs from [fixtures.ts](../tests/fixtures.ts) - ask the user if
  a post is deleted or unreachable
- Use `assertMedia()` helper from [utils.ts](../tests/utils.ts) for consistent
  assertions
- Tests have 30s timeout due to network calls: `}, 30_000);`
- Test both single items and galleries/carousels when platform supports them

## Code Style

- Biome for formatting and linting (not ESLint/Prettier)
- Double quotes, 2-space indent, 80 char line width
- Use `.ts` extensions in imports (`import x from "./file.ts"`)
- snake_case for local variables and functions, PascalCase for types/errors
- No `any` warnings disabled in biome.json - use sparingly for API responses
