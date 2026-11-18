# @perfectpan/lint-config

Shared oxlint, oxfmt and tsconfig rules for PerfectPan's JS/TS repositories. Each repository consumes this package
instead of keeping its own copy of the same settings, and keeps only its project-specific rules locally.

The package is not published to npm. Install it as a git dependency pinned to a tag:

```json
{
  "devDependencies": {
    "@perfectpan/lint-config": "github:PerfectPan/lint-config#v0.9.1"
  }
}
```

MoonBit repositories do not use this package; it only covers JavaScript and TypeScript tooling.

## Files

| Export                                          | What it is                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `@perfectpan/lint-config/oxlint.json`           | oxlint base config: plugins, categories, options, rules and overrides        |
| `@perfectpan/lint-config/oxfmt.json`            | oxfmt options and the ignore for generated `CHANGELOG.*` files               |
| `@perfectpan/lint-config/jscpd.json`            | jscpd gate profile: exact duplicates fail with the zero threshold            |
| `@perfectpan/lint-config/jscpd-audit.json`      | jscpd audit profile: renamed and AST-similar candidates, no default threshold |
| `@perfectpan/lint-config/tsconfig/base.json`    | strict compiler options without module, output, `types` or `include` choices |
| `@perfectpan/lint-config/tsconfig/node.json`    | `base.json` + `module`/`moduleResolution` `NodeNext`                         |
| `@perfectpan/lint-config/tsconfig/bundler.json` | `base.json` + `ESNext`/`Bundler` resolution, JSON imports, `noEmit`          |
| `@perfectpan/lint-config/knip`                  | ESM module exporting the shared Knip policy (hints fail the run)             |
| `@perfectpan/lint-config/doc-translations`      | ESM module checking that translated Markdown documents match their sources   |
| `@perfectpan/lint-config/vite-plus`             | ESM module exporting `lint` and `fmt` (the two JSON files) and `defineLint`  |

The package has no runtime dependencies. `oxlint`, `oxlint-tsgolint`, `oxfmt`, `typescript`, `vite-plus`,
`eslint-plugin-better-tailwindcss`, `jscpd` and `knip` are optional peer dependencies; install the ones your setup uses.
The oxlint config needs oxlint 1.79 or later (see [File rules](docs/decisions.md#file-rules)).

## Usage

The self-test in `test/consumer` exercises each setup below.

### vite-plus

```ts
import { defineLint, fmt } from "@perfectpan/lint-config/vite-plus";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ...fmt,
    ignorePatterns: [...fmt.ignorePatterns, "dist/**", "*.md"]
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
`overrides: []` replaces the shared ones. The same holds for `fmt.ignorePatterns`: the shared list skips the
`CHANGELOG.*` files that release tools generate, so a repository adding its own patterns spreads
`...fmt.ignorePatterns` first.

### Standalone oxlint and oxfmt

```sh
pnpm add -D oxlint oxlint-tsgolint oxfmt typescript "github:PerfectPan/lint-config#v0.9.1"
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
needs its own ignore patterns. oxfmt resolves `ignorePatterns` from the directory of the config file, so the shared
`CHANGELOG.*` ignore applies only through a config in the repository; with `-c` pointing at the shared file,
generated changelogs are checked:

```sh
oxfmt -c node_modules/@perfectpan/lint-config/oxfmt.json --check .
```

```ts
import { fmt } from "@perfectpan/lint-config/vite-plus";
import { defineConfig } from "oxfmt";

export default defineConfig({ ...fmt, ignorePatterns: [...fmt.ignorePatterns, "dist/**"] });
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

### Duplicate detection (jscpd)

Both profiles are path-free JSON: scan roots, formats, ignore patterns, baseline and output belong to the
repository and stay in its own command. jscpd has no config `extends`, so point `--config` at the installed
file; a CLI option with a non-empty list **replaces** the profile's value, so keep every ignore pattern in one
place instead of splitting the list between the profile and the command.

```sh
# The exact gate: an exact clone fails the run with the zero threshold.
jscpd --config node_modules/@perfectpan/lint-config/jscpd.json packages --format 'typescript,javascript' --ignore '**/*.test.ts'

# The audit profile reports renamed-identifier and AST-similar candidates without a default threshold. AST
# similarity leaves test files out in this jscpd version, and a reported candidate still needs a
# behaviour review before anyone calls it removable code.
jscpd --config node_modules/@perfectpan/lint-config/jscpd-audit.json packages scripts --output reports/jscpd
```

An empty scan (no file survived the roots, formats and ignores) fails through `failOnEmpty`, so a broad ignore
cannot silence the gate silently.
After reviewing its findings, a consumer may set a CLI threshold for the audit profile. Empty-input and
execution errors still fail even when duplicate findings are non-blocking.

### Unused code (knip)

`@perfectpan/lint-config/knip` exports plain data: configuration and tag hints fail the run. Spread it into the
repository's own Knip configuration; `entry`, `project`, `paths`, workspaces, ignores and plugin paths are
repository data, and there is no `extends` — ordinary object spread is the composition, and array values of the
preset are replaced by the repository's own unless it concatenates them.

```ts
// knip.ts
import { knip } from "@perfectpan/lint-config/knip";
import type { KnipConfig } from "knip";

export default {
  ...knip,
  entry: ["src/index.ts"],
  project: ["src/**/*.ts"]
} satisfies KnipConfig;
```

Run the ordinary and the production analysis separately (`knip`, `knip --production`); they answer different
questions, because test files keep otherwise unused files alive only in the ordinary run. Knip itself can fix
issues; this preset only analyses, and this package ships no wrapper for running it.

### Documentation translations

`@perfectpan/lint-config/doc-translations` checks Markdown documents that have a translation, such as a Chinese reading
copy of each English guide. It has no dependencies; it uses `fs.globSync` and `path.matchesGlob`, and CI runs it on
Node.js 26. The repository says which documents are translated and where each translation lives, then calls
`runDocTranslations` from a script that CI and the pre-commit hook run:

```js
// scripts/check-doc-translations.mjs
import process from "node:process";
import { runDocTranslations } from "@perfectpan/lint-config/doc-translations";

process.exitCode = runDocTranslations({
  sources: ["README.md", "docs/guide/*.md"],
  translations: ["README.zh-CN.md", "docs/**/*.zh-CN.md"],
  exclude: ["docs/guide/0000-template.md"],
  translationOf: (path) => path.replace(/\.md$/, ".zh-CN.md"),
  header: (path) => `> 中文阅读版。以英文原文 ${path} 为准。`,
  stamp: true
});
```

A tree per language works the same way: `sources: ["docs/en/**/*.md"]`, `translations: ["docs/zh-CN/**/*.md"]`,
`translationOf: (path) => path.replace(/^docs\/en\//, "docs/zh-CN/")`. Keep the patterns under the documentation
directories; a pattern starting with `**` walks the whole repository.

For every pair the check requires:

- the translation exists, every file `translations` matches belongs to a document in scope, and `translationOf` maps
  each document to its own path inside `translations`;
- the `header` line first, when given (after the YAML frontmatter, in a translation that has one);
- the source's headings (levels in order), code blocks (language and body unchanged; meta after the language, such as
  a `title="…"` caption, may be translated), tables (rows and columns), list items (kind and indent) and links, in
  the same order. Frontmatter is page metadata, not Markdown, and is not compared;
- links to a translated document point to its translation and links to a translation point back to its source,
  other targets stay as written (a target starting with `/` resolves from the repository root), and every
  `#fragment` in the translation that points to a `.md` file names a heading or `id` in it, with GitHub's heading
  anchors (fragments to `.mdx` pages and site routes are not checked);
- with `stamp: true`, the Git blob hash of the source as it was when the translation was confirmed: a
  `<!-- source-blob: <hash> -->` line after the header, or a `source-blob: <hash>` key in the frontmatter of a
  translation that has one, such as an MDX page. Editing a source fails the check until its translation is updated
  and recorded again with `node scripts/check-doc-translations.mjs --write <source or translation>...` (paths
  relative to the working directory), which writes the line only for pairs that pass every other check. `git show <hash>` prints the confirmed source, so the change
  to carry over into the translation is the difference between that text and the current source.

The check cannot tell whether the translation says the same thing; reviewers check that.
[docs/decisions.md](docs/decisions.md#documentation-translations) records what the line-based scan leaves out.

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

`pnpm test:floors` installs the fixture in `test/floors`, where every peer dependency is pinned to the lowest version in
package.json's peerDependencies, and runs the same kind of smoke checks against it. This keeps the floors proven:
CI lints, formats and type-checks sample files with exactly those versions on every run.

## License

MIT. See [LICENSE](LICENSE).

Development and CI use Node.js `^26.13.1` (`>=26.13.1 <27`) and the pnpm version in `packageManager`. `.node-version` selects major 26; `devEngines.runtime` rejects development installs below the security floor or on another major. CI resolves the latest matching release with `check-latest: true`. The consumer fixture retains its Node 24 types and the peer-floor fixture retains its existing minimum versions.
