# @perfectpan/lint-config

Shared oxlint, oxfmt and tsconfig rules for PerfectPan's JS/TS repositories. Each repository consumes this package
instead of keeping its own copy of the same settings, and keeps only its project-specific rules locally.

The package is not published to npm. Install it as a git dependency pinned to a tag:

```json
{
  "devDependencies": {
    "@perfectpan/lint-config": "github:PerfectPan/lint-config#v0.1.0"
  }
}
```

MoonBit repositories do not use this package; it only covers JavaScript and TypeScript tooling.

## Files

| Export                                          | What it is                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `@perfectpan/lint-config/oxlint.json`           | oxlint base config: plugins, categories, options and rules                   |
| `@perfectpan/lint-config/oxfmt.json`            | oxfmt options                                                                |
| `@perfectpan/lint-config/tsconfig/base.json`    | strict compiler options without module, output, `types` or `include` choices |
| `@perfectpan/lint-config/tsconfig/node.json`    | `base.json` + `module`/`moduleResolution` `NodeNext`                         |
| `@perfectpan/lint-config/tsconfig/bundler.json` | `base.json` + `ESNext`/`Bundler` resolution, JSON imports, `noEmit`          |
| `@perfectpan/lint-config/vite-plus`             | ESM module exporting `{ lint, fmt }`, the same data as the two JSON files    |

`vite-plus` reads `oxlint.json` and `oxfmt.json` at import time, so the JSON files are the only source of the values.
The package has no runtime dependencies. `oxlint`, `oxlint-tsgolint`, `oxfmt`, `typescript` and `vite-plus` are
optional peer dependencies; install the ones your setup uses.

## Decisions

### Lint

- **Categories:** `correctness` is an error. Other categories stay off by default; a repository opts in per category
  (for example `"suspicious": "warn"`).
- **Plugins:** `import`, `node`, `oxc`, `promise`, `typescript`, `unicorn`, `vitest`. Their `correctness` rules run
  by default; rules in other categories run only when a repository enables them.
- **`denyWarnings: true`:** a warning fails the run. Rules are either worth fixing (error) or not worth reporting
  (off); a warning that never fails CI accumulates until nobody reads the output.
- **`reportUnusedDisableDirectives: "error"`:** a stale `oxlint-disable` comment is an error, so suppressions are
  removed once the code no longer needs them.
- **`typeAware` and `typeCheck`:** type-aware rules and TypeScript diagnostics run inside the lint pass through
  `oxlint-tsgolint`, using the repository's `tsconfig.json`. A lint run therefore also reports type errors.
- **Rules:** `no-unused-vars` and `no-unsafe-optional-chaining` are errors. `vitest/no-conditional-expect` is off,
  because tests that branch on a result type and assert each branch are a common, readable pattern.
- **`curly: ["error", "all"]`:** every `if`, `else`, `for`, `while` and `do` body is braced, including single
  statements. An unbraced body invites the bug where a second statement is added at the same indentation but runs
  unconditionally, and braced bodies keep diffs to the changed line. `oxlint --fix` inserts the braces on one line
  (`if (x) {return 1;}`); running the formatter afterwards expands the block onto separate lines.

### Format

`oxfmt.json` is the default style for new repositories. An existing repository may override the quote, semicolon
and trailing-comma options to avoid reformatting its whole history; for example agent-trace keeps `semi: false`,
`singleQuote: true` and `trailingComma: "all"`.

- `printWidth: 120`: fewer wrapped lines for TypeScript signatures and template strings.
- `trailingComma: "none"`.
- `sortPackageJson: false`: `package.json` keeps its hand-written field order.

### TypeScript

`tsconfig/base.json` enables `strict` plus the flags that catch real bugs under strict mode:
`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`, `noUnusedLocals`,
`noUnusedParameters`, `allowUnreachableCode: false`, `allowUnusedLabels: false` and
`forceConsistentCasingInFileNames`. `verbatimModuleSyntax` makes type-only imports explicit, so the emitted imports
match the source. `skipLibCheck` is on because type errors inside dependencies are not actionable. `target` is
`ES2022`.

Output settings (`outDir`, `rootDir`, `declaration`, `sourceMap`), `types`, `lib`, `include` and `exclude` depend on
each repository and are left to it. `bundler.json` sets `noEmit` and `allowImportingTsExtensions` because a bundler,
not `tsc`, produces the output; a library that emits declarations overrides both.

## Usage

The snippets below are the ones exercised by the self-test in `test/consumer`.

### Standalone oxlint and oxfmt

```sh
pnpm add -D oxlint oxlint-tsgolint oxfmt typescript "github:PerfectPan/lint-config#v0.1.0"
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

### vite-plus

```ts
import { fmt, lint } from "@perfectpan/lint-config/vite-plus";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ...fmt,
    ignorePatterns: ["dist/**", "*.md"]
  },
  lint: {
    ...lint,
    ignorePatterns: ["dist/**"],
    rules: {
      ...lint.rules,
      "no-console": "error"
    },
    overrides: [
      {
        files: ["packages/core/src/**/*.ts"],
        rules: { "no-restricted-imports": ["error", { patterns: ["node:*"] }] }
      }
    ]
  }
});
```

Spread the nested objects (`rules`, `options`) as well when adding to them; a plain `rules: {}` replaces the shared
rules instead of extending them.

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

## Overrides

Anything project-specific belongs in the consuming repository: ignore paths, `no-restricted-imports` boundaries
between packages, extra categories, environment globals and output settings. Keys set locally win over the shared
values:

- oxlint JSON and `oxlint.config.ts`: `extends` is applied first, then the local file's `rules`, `overrides` and
  other keys.
- vite-plus and `oxfmt.config.ts`: normal object spread; later keys win.
- tsconfig: local `compilerOptions` override the extended ones key by key.

Change a shared default here only when every consuming repository should follow it.

## Versioning

Releases are git tags (`v0.1.0`, `v0.2.0`, ...). Consumers pin a tag in the dependency spec and bump it to take a
new release. A release that turns on a new error, or removes an export, is a minor bump while the version is `0.x`.

## Development

```sh
pnpm install
pnpm test
```

`pnpm test` runs `scripts/self-test.sh`, which lints, formats and type-checks the fixture project in
`test/consumer`. Each negative case must fail with a specific diagnostic (an unused variable, a type error from
`noUncheckedIndexedAccess`, a warning under `denyWarnings`, an unused disable directive), so a config that stops
applying fails the test.

## License

MIT
