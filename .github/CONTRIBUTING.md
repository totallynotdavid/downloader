# Contributing

## Setup

[mise](https://mise.jdx.dev) installs the pinned Bun, Node and oxfmt from
[`mise.toml`](../mise.toml). Every command below is a `package.json` script.

```sh
mise install
bun install --frozen-lockfile
```

## Checks

Run `bun run check` before you commit. CI runs the same script on every pull
request.

```sh
bun run check      # lint, typecheck, test and build
bun run fix        # safe Biome fixes, then format code, Markdown and YAML
bun run test       # offline replay tests
bun run build      # bundle to dist/
```

`bun run release` runs `check`, then publishes to npm. The release workflow
calls it on a version tag.

## Code style

Biome enforces formatting and lint for code and JSON. oxfmt formats Markdown and
YAML. The rest is convention:

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
- [Architecture](../docs/architecture.md)
- [Writing an extractor](../docs/extractors.md)
- [Tests and cassettes](../docs/testing.md)
- [Live eval](../docs/eval.md)
