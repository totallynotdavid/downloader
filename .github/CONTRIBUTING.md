# Contributing

## Setup

[mise](https://mise.jdx.dev) installs the pinned Bun and Biome from
[`mise.toml`](../mise.toml).

```sh
mise install
bun install
```

## Checks

Run these before you commit. CI runs Biome and the tests on every pull request
that changes a `.ts` file.

```sh
bun run check   # Biome lint and the TypeScript typecheck
bun run test    # offline replay tests
bun run format  # Biome for code, Prettier for Markdown and YAML
```

`bun run build` runs `check`, then bundles to `dist/`.

## Code style

Biome enforces formatting and lint. The rest is convention:

- Internal functions and variables use `snake_case`. Types and error classes use
  `PascalCase`.
- The public API (`resolve`, `listInstagramPosts`) and third-party field names
  keep their own casing.
- Imports end in `.ts`.
- A comment states what the code cannot say. It carries no history.

## Commits

Write `area: summary`, then a blank line and the reason when the diff cannot
show it.

- `area` is one lowercase word for where the change is, such as `instagram`,
  `docs`, `test`, `ci` or `build`.
- `summary` starts with a lowercase imperative verb, such as `add`, `fix` or
  `remove`. It has no period.
- Put code, its tests, and the note that documents it in separate commits.

```text
instagram: add account post listing
```

## Where to read next

- [Documentation index](../docs/readme.md)
- [Architecture](../architecture.md)
- [Writing an extractor](../docs/extractors.md)
- [Tests and cassettes](../docs/testing.md)
- [Live eval](../docs/eval.md)
