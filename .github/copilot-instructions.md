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
├── router.ts     # URL -> extractor mapping by hostname
├── http.ts       # Shared fetch wrappers with timeout/error handling
├── types.ts      # MediaResult, MediaItem, ResolveOptions
├── errors.ts     # PlatformNotSupportedError, NetworkError, ParseError
└── extractors/   # One file per platform (instagram.ts, reddit.ts, etc.)
```

**Data flow**: `resolve(url)` -> `router.route(url)` -> platform extractor ->
`MediaResult`

## Commands

```sh
bun test
bun test instagram # equivalent to "bun test tests/extractors/instagram.test.ts"
bun run build
bun run format
```

## Extractor patterns

- Use `http_get`/`http_post` from `../http.ts` for requests
- Throw `ParseError` with platform name for extraction failures
- Re-throw `NetworkError` and `ParseError`, wrap unknown errors in `ParseError`
- Generate filenames as `{platform}-{id}.{ext}` or
  `{platform}-{id}-{index}.{ext}` for galleries
- Include required headers in `result.headers` for downloading

## Testing

- Tests use real URLs from `tests/fixtures.ts`
- Use `assertMedia()` helper from `tests/utils.ts`
- Tests have 30s timeout due to network calls
- Test both single items and galleries when platform supports them

## Code style

- Biome for formatting (not ESLint/Prettier)
- Double quotes, 2-space indent, 80 char line width
- `.ts` extensions in imports
- snake_case for variables/functions, PascalCase for types/errors

See [CONTRIBUTING.md](./CONTRIBUTING.md) for adding new extractors and API
response reference.
