# @perfectpan/lint-config

Shared oxlint, oxfmt and tsconfig rules for PerfectPan's JS/TS repositories. Each repository consumes this package
instead of keeping its own copy of the same settings, and keeps only its project-specific rules locally.

The package is not published to npm. Install it as a git dependency pinned to a tag:

```json
{
  "devDependencies": {
    "@perfectpan/lint-config": "github:PerfectPan/lint-config#v0.7.0"
  }
}
```

MoonBit repositories do not use this package; it only covers JavaScript and TypeScript tooling.

## Files

| Export                                          | What it is                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `@perfectpan/lint-config/oxlint.json`           | oxlint base config: plugins, categories, options, rules and overrides        |
| `@perfectpan/lint-config/oxfmt.json`            | oxfmt options                                                                |
| `@perfectpan/lint-config/tsconfig/base.json`    | strict compiler options without module, output, `types` or `include` choices |
| `@perfectpan/lint-config/tsconfig/node.json`    | `base.json` + `module`/`moduleResolution` `NodeNext`                         |
| `@perfectpan/lint-config/tsconfig/bundler.json` | `base.json` + `ESNext`/`Bundler` resolution, JSON imports, `noEmit`          |
| `@perfectpan/lint-config/vite-plus`             | ESM module exporting `lint` and `fmt` (the two JSON files) and `defineLint`  |

The package has no runtime dependencies. `oxlint`, `oxlint-tsgolint`, `oxfmt`, `typescript`, `vite-plus` and
`eslint-plugin-better-tailwindcss` are optional peer dependencies; install the ones your setup uses. The oxlint config
needs oxlint 1.79 or later (see [File rules](docs/decisions.md#file-rules)).

## Usage

The self-test in `test/consumer` exercises each setup below.

### vite-plus

```ts
import { defineLint, fmt } from "@perfectpan/lint-config/vite-plus";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ...fmt,
    ignorePatterns: ["dist/**", "*.md"]
  },
  lint: defineLint({
    ignorePatterns: ["dist/**"],
    rules: { "no-console": "error" },
    overrides: [
      {
        files: ["packages/core/src/**/*.ts"],
        rules: { "no-restricted-imports": ["error", { patterns: ["node:*"] }] }
      }
    ]
  })
});
```

`defineLint` merges the repository's config into the shared one: `categories`, `options` and `rules` merge key by
key, `plugins` are added, and `overrides` apply in a fixed order: shared, then the [opt-in checks](#opt-in-checks),
then the repository's own, because a later override wins.

Without `defineLint`, spread every nested value (`...lint.rules`, `...lint.overrides` first); a plain `rules: {}` or
`overrides: []` replaces the shared ones.

### Standalone oxlint and oxfmt

```sh
pnpm add -D oxlint oxlint-tsgolint oxfmt typescript "github:PerfectPan/lint-config#v0.7.0"
```

`oxlint-tsgolint` is required because the base config enables `typeAware` and `typeCheck`.

`.oxlintrc.json`:

```json
{
  "extends": ["./node_modules/@perfectpan/lint-config/oxlint.json"],
  "ignorePatterns": ["dist/**"],
  "overrides": [
    {
      "files": ["src/cli/**/*.ts"],
      "rules": { "no-console": "off" }
    }
  ]
}
```

JSON `extends` entries are file paths resolved relative to the config file. A package specifier such as
`"@perfectpan/lint-config/oxlint.json"` fails with "No such file or directory". To extend by package name, use
`oxlint.config.ts` instead:

```ts
import { lint } from "@perfectpan/lint-config/vite-plus";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [lint],
  ignorePatterns: ["dist/**"]
});
```

oxfmt has no `extends`. Point it at the shared file, or spread the options in `oxfmt.config.ts` when the repository
needs its own ignore patterns:

```sh
oxfmt -c node_modules/@perfectpan/lint-config/oxfmt.json --check .
```

```ts
import { fmt } from "@perfectpan/lint-config/vite-plus";
import { defineConfig } from "oxfmt";

export default defineConfig({ ...fmt, ignorePatterns: ["dist/**"] });
```

### TypeScript

```json
{
  "extends": "@perfectpan/lint-config/tsconfig/node.json",
  "compilerOptions": {
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

Use `tsconfig/bundler.json` for code built by Vite, tsdown or another bundler, and `tsconfig/base.json` when the
repository sets `module` itself. TypeScript resolves the package specifier through the `exports` map.

## Opt-in checks

`defineLint` takes two checks for front ends. Each is off unless its option is given (`false` also turns it off).

- `tailwind: { stylesheets, literalValues }` checks Tailwind CSS v4 classes against each stylesheet's theme: unknown,
  conflicting, duplicate, non-canonical and concatenated classes, and literal colours or lengths in arbitrary values
  (`literalValues: false` turns that last rule off). Needs `eslint-plugin-better-tailwindcss` 4.10 or later.
- `shadcn: { ui, elements }` keeps the listed `elements` and Radix primitives inside the shadcn/ui files in `ui`, and
  lets those files hold several components. Needs no extra dependency.

```ts
import { fileURLToPath } from "node:url";

const appCss = fileURLToPath(new URL("./src/styles/app.css", import.meta.url));

lint: defineLint({
  tailwind: { stylesheets: [{ entryPoint: appCss, files: ["src/**/*.{ts,tsx}"] }] },
  shadcn: { ui: ["src/components/ui/*.tsx"], elements: ["button"] }
});
```

Each `stylesheets` entry takes `entryPoint`, `files` and optional `excludeFiles`. `entryPoint` is the absolute path of
a stylesheet that imports Tailwind: the plugin looks a relative path up from the working directory and, when nothing
matches, falls back to Tailwind's default theme and reports the project's own tokens as unknown. The rules read
classes in `class` and `className` and in `cn()`, `clsx()`, `cva()` and the other helpers the plugin recognizes. The
rules and their reasons are in [docs/decisions.md](docs/decisions.md#opt-in-checks).

## Docs

- [docs/decisions.md](docs/decisions.md): why each shared rule, flag and opt-in check is set the way it is.
- [docs/overrides.md](docs/overrides.md): how local settings combine with the shared ones, and how to exempt
  framework or generated paths.

## Versioning

Releases are git tags (`v0.1.0`, `v0.2.0`, ...). Consumers pin a tag in the dependency spec and bump it to take a
new release. A release that turns on a new error, or removes an export, is a minor bump while the version is `0.x`.

## Development

```sh
pnpm install
pnpm test
```

`pnpm test` runs `scripts/self-test.sh` against the fixture project in `test/consumer`. Each negative case must fail
with a specific diagnostic and each clean source must pass, so a config that stops applying fails the test; the
script lists the cases.

## License

MIT. See [LICENSE](LICENSE).
