# @perfectpan/lint-config

Shared oxlint, oxfmt and tsconfig rules for PerfectPan's JS/TS repositories. Each repository consumes this package
instead of keeping its own copy of the same settings, and keeps only its project-specific rules locally.

The package is not published to npm. Install it as a git dependency pinned to a tag:

```json
{
  "devDependencies": {
    "@perfectpan/lint-config": "github:PerfectPan/lint-config#v0.5.0"
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
| `@perfectpan/lint-config/vite-plus`             | ESM module exporting `{ lint, fmt }`, the same data as the two JSON files    |

`vite-plus` reads `oxlint.json` and `oxfmt.json` at import time, so the JSON files are the only source of the values.
The package has no runtime dependencies. `oxlint`, `oxlint-tsgolint`, `oxfmt`, `typescript` and `vite-plus` are
optional peer dependencies; install the ones your setup uses. The oxlint config needs oxlint 1.79 or later (see
[File rules](#file-rules)).

## Decisions

### Lint

- **Categories:** `correctness` is an error. Other categories stay off by default; a repository opts in per category
  (for example `"suspicious": "warn"`).
- **Plugins:** `import`, `node`, `oxc`, `promise`, `typescript`, `unicorn`, `vitest`. Their `correctness` rules run
  by default; rules in other categories run only when a repository enables them. `react` is enabled only in an
  override for `.jsx` and `.tsx` files, for the single rule described under [File rules](#file-rules).
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
- **`no-unnecessary-condition` with `allowConstantLoopConditions: "always"`:** a condition, optional chain or `??`
  whose outcome the types already decide is an error (type-aware; runs through the `typeAware` pass above). An
  optional chain or fallback on a value that is never nullish hides the real shape of the data and survives refactors
  that make a field required; schemas at the boundary make fields required, and this rule removes the leftover
  `?.` and `??`. It does not ban `?.` or `??` on genuinely optional values — only on values the types prove are
  never nullish or always falsy. `allowConstantLoopConditions: "always"` keeps `while (true)` as the intentional
  infinite-loop idiom; `while (false)` and other constant loop conditions still fail. `checkTypePredicates` keeps
  its default (`false`).
- **`no-use-before-define` with `functions: false`:** a `const`, `let`, `var`, `class` or `enum` in any scope —
  including an arrow-function constant and a name in an `export { name }` list — must not be referenced above its
  declaration, so a file reads top-down and the reader meets a name after learning what it holds. TypeScript already
  rejects a direct top-level read in the temporal dead zone (TS2448–TS2450); this rule also catches references inside
  function bodies, which only fail at runtime when the function runs before the declaration. Function declarations
  are exempt because they hoist: an entry function at the top calling helpers below it is the intended reading order.
  Type-only references stay allowed through the default `ignoreTypeReferences`.

### File rules

Three rules constrain files rather than code: kebab-case names, at most 1000 lines, and one component per component
file. They keep files easy to find and short. [Exempting paths](#exempting-paths) shows how a repository opts
directories out, for example framework route files.

- **`unicorn/filename-case` with `kebabCase`:** one naming scheme for every source file, and no case-only renames,
  which Git misses on case-insensitive file systems. The rule checks only the part of the base name before the first
  dot, with leading and trailing `_` removed; dotfiles and files named `index` are skipped. Directory names and files
  that oxlint does not lint (Markdown, JSON, CSS) are not checked.

  A route parameter in a file name is the parameter name the code reads, usually camelCase, and the framework
  decides its syntax. The shared options therefore ignore a base name whose first dot-segment is exactly one
  parameter. The `ignore` regular expressions match the base name:

  - `^\[\[?(?:\.\.\.)?\w+\]\]?\.`: Next.js dynamic segments `[roomId].tsx`, `[...slugParts].tsx` and
    `[[...slugParts]].tsx`.
  - `^(?:\$\w*|\(\$\w+\)|\{-\$\w+\})\.`: TanStack Router, Remix and React Router parameters `$postId.tsx`,
    `$postId.edit.tsx`, `$postId_.edit.tsx` and the splat `$.tsx`, plus the optional forms `($langCode).tsx` (Remix,
    React Router) and `{-$localeCode}.tsx` (TanStack Router).

  A parameter followed by more name in the same segment is still checked, so `[id]Helper.tsx` and
  `[roomId]-panel.tsx` fail. Static segments before a parameter are checked as usual: `room.$roomId.tsx` passes and
  `roomList.$roomId.tsx` fails.

  Names that pass: `foo-bar.ts`, `foo.test.ts`, `vite.config.ts`, `index.d.ts`, `_app.tsx`, `__root.tsx`,
  `room._index.tsx`, and the route parameters above. Names that fail: `FooBar.tsx`, `useFoo.ts`, `foo_bar.ts`,
  `_myLayout.tsx`, `[id]Helper.tsx`.

- **`max-lines: 1000`:** a file past 1000 lines usually holds more than one responsibility. Every line counts,
  including blank lines and comments; a final newline does not start a new line, so for files that end with one the
  count matches `wc -l`. Test files are exempt through an override matching `**/*.{test,spec}.*`, `**/__tests__/**`,
  `**/test/**` and `**/tests/**`, because scenario and table-driven suites grow long without getting harder to
  follow.

- **`react/no-multi-comp` in `.jsx` and `.tsx` files:** a component file holds one component. The rule counts
  capitalized functions and arrow functions that return JSX, `memo` and `forwardRef` wrappers and class components;
  a component defined inside another component is not counted. Solid components are detected the same way. Test
  files are excluded, so a test can define several helper components.

  The rule exists only in oxlint's `react` plugin, and enabling a plugin, even in an override, also enables its rules
  in every category the repository turns on. Several of them report valid Solid code: `react/jsx-key` asks for keys
  that Solid does not use, and the React Compiler rules (`react/purity`, `react/refs`, `react/immutability` and
  others) assume that a component body runs on every render. On agent-trace's Solid app they report 7 errors. The
  override therefore turns off every other react rule, so it adds only `react/no-multi-comp` whatever categories the
  repository enables. `pnpm test` fails when an oxlint upgrade adds a react rule that the override does not list.

  Listing those rules by name requires **oxlint 1.79 or later**; older versions refuse to load the config with
  `Rule '…' not found in plugin 'react'`. vite-plus runs the project's own `oxlint` when one is installed and its
  bundled copy otherwise. vite-plus 0.2.x bundles an older oxlint, so install `oxlint` next to it or use vite-plus
  0.3.0 or later.

  `react/only-export-components` is a related rule with a different purpose: it keeps Vite Fast Refresh working by
  requiring that a file exporting components exports nothing else. A React and Vite repository can enable it in its
  own `.jsx`/`.tsx` override (see [Exempting paths](#exempting-paths) for why that override lists the plugin).

### Format

`oxfmt.json` is the default style for new repositories. An existing repository may override the quote, semicolon
and trailing-comma options to avoid reformatting its whole history; for example agent-trace keeps `semi: false`,
`singleQuote: true` and `trailingComma: "all"`.

- `printWidth: 120`: fewer wrapped lines for TypeScript signatures and template strings.
- `trailingComma: "none"`.
- `sortPackageJson: false`: `package.json` keeps its hand-written field order.

### TypeScript

`tsconfig/base.json` enables `strict` plus the flags that catch real bugs under strict mode:
`noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`,
`allowUnreachableCode: false`, `allowUnusedLabels: false` and `forceConsistentCasingInFileNames`.

`exactOptionalPropertyTypes` is off by default. It separates an absent property from one set to `undefined`, which
matters for spreads over defaults and for serialized data, but most component props and parser results pass
`undefined` through on purpose, and repositories adopting it tended to widen every optional type to `?: T | undefined`,
which defeats the flag. A repository whose code already distinguishes the two cases turns it on in its own
`tsconfig.json`. `verbatimModuleSyntax` makes type-only imports explicit, so the emitted imports
match the source. `skipLibCheck` is on because type errors inside dependencies are not actionable. `target` is
`ES2022`.

Output settings (`outDir`, `rootDir`, `declaration`, `sourceMap`), `types`, `lib`, `include` and `exclude` depend on
each repository and are left to it. `bundler.json` sets `noEmit` and `allowImportingTsExtensions` because a bundler,
not `tsc`, produces the output; a library that emits declarations overrides both.

## Usage

The snippets below are the ones exercised by the self-test in `test/consumer`.

### Standalone oxlint and oxfmt

```sh
pnpm add -D oxlint oxlint-tsgolint oxfmt typescript "github:PerfectPan/lint-config#v0.5.0"
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
      ...lint.overrides,
      {
        files: ["packages/core/src/**/*.ts"],
        rules: { "no-restricted-imports": ["error", { patterns: ["node:*"] }] }
      }
    ]
  }
});
```

Spread the nested values (`rules`, `options`, `overrides`) as well when adding to them. A plain `rules: {}` replaces
the shared rules instead of extending them, and a plain `overrides: []` drops the test-file exemption from
`max-lines` and the `react/no-multi-comp` override. Put `...lint.overrides` first so that the repository's own
overrides apply after the shared ones.

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
  other keys. Shared overrides apply before local overrides.
- vite-plus and `oxfmt.config.ts`: normal object spread; later keys win.
- tsconfig: local `compilerOptions` override the extended ones key by key.

An override always wins over top-level `rules` for the files it matches. A top-level setting for a `react/*` rule
therefore has no effect on `.jsx` and `.tsx` files, where the shared override turns every react rule except
`react/no-multi-comp` off; set react rules in a local override as shown below.

Change a shared default here only when every consuming repository should follow it.

### Exempting paths

Frameworks decide some file names and exports, and generated or vendored code follows its generator. Exempt such
paths with a local override instead of renaming or splitting them. The snippets use `.oxlintrc.json`; the same
objects go into `overrides` in `oxlint.config.ts` or vite-plus.

File names: route files named after the conventions of Next.js, TanStack Router, Remix and React Router already
pass (see [File rules](#file-rules)). For other names a framework or generator decides, turn the rule off for the
directory:

```json
{ "files": ["src/generated/**"], "rules": { "unicorn/filename-case": "off" } }
```

or add base-name regular expressions to `ignore`. Rule options replace the shared ones instead of merging with
them, so repeat `case` and the shared `ignore` entries. In `oxlint.config.ts` or vite-plus, spread them from the
shared config:

```ts
const [, filenameCase] = lint.rules["unicorn/filename-case"];

// in the lint config
rules: {
  ...lint.rules,
  "unicorn/filename-case": ["error", { ...filenameCase, ignore: [...filenameCase.ignore, "^\\d{4}_"] }]
}
```

Components: React Router and Remix route modules export `ErrorBoundary`, `Layout` or `HydrateFallback` next to the
default component, and shadcn/ui files export a family of components. Turn `react/no-multi-comp` off for them with
an override that also lists the react plugin:

```json
{
  "files": ["app/routes/**/*.tsx", "app/root.tsx", "app/components/ui/**/*.tsx"],
  "plugins": ["react"],
  "rules": { "react/no-multi-comp": "off" }
}
```

- Without `"plugins": ["react"]` oxlint ignores a `react/*` setting in an override without any message.
- Keep `files` to `.jsx` and `.tsx` source files. The override enables the react plugin for every file it matches;
  for files outside the shared override (`.ts` files, test files) that also enables the react rules of the
  categories the repository turns on.

A React repository that wants react rules enables them with the same override shape:

```json
{
  "files": ["**/*.{jsx,tsx}"],
  "excludeFiles": ["**/*.{test,spec}.*", "**/__tests__/**", "**/test/**", "**/tests/**"],
  "plugins": ["react"],
  "rules": { "react/jsx-key": "error", "react/only-export-components": "error" }
}
```

## Versioning

Releases are git tags (`v0.1.0`, `v0.2.0`, ...). Consumers pin a tag in the dependency spec and bump it to take a
new release. A release that turns on a new error, or removes an export, is a minor bump while the version is `0.x`.

## Development

```sh
pnpm install
pnpm test
```

`pnpm test` runs `scripts/self-test.sh`, which lints, formats and type-checks the fixture project in
`test/consumer`. Each negative case must fail with a specific diagnostic (an unused variable, a `const` read above
its declaration, an unnecessary condition on a non-nullish value, a type error from `noUncheckedIndexedAccess`, a
warning under `denyWarnings`, an unused disable directive, a PascalCase file name, a route parameter followed by
more name, a 1001-line source file, two components in one `.tsx` file), so a config that stops applying fails the
test. The clean sources include framework route file names, a Solid-style component that React's correctness rules
would report, a test file with two components, a function declared below its caller, a type referenced before its
declaration and a `while (true)` loop, and the script generates a 1001-line test file that must pass. It also checks
that the react override lists every react rule of the installed oxlint.

## License

MIT. See [LICENSE](LICENSE).
