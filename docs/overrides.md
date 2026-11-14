# Overrides

Anything project-specific belongs in the consuming repository: ignore paths, `no-restricted-imports` boundaries
between packages, extra categories, environment globals and output settings. Keys set locally win over the shared
values:

- oxlint JSON and `oxlint.config.ts`: `extends` is applied first, then the local file's `rules`, `overrides` and
  other keys. Shared overrides apply before local overrides.
- `defineLint`: `categories`, `options` and `rules` merge key by key, `plugins` are added, and local overrides apply
  after the shared ones and the opt-in checks. Other keys replace the shared value.
- `oxfmt.config.ts` and a hand-spread vite-plus config: normal object spread; later keys win.
- tsconfig: local `compilerOptions` override the extended ones key by key.

An override always wins over top-level `rules` for the files it matches. A top-level setting for a `react/*` rule
therefore has no effect on `.jsx` and `.tsx` files, where the shared override turns every react rule except
`react/no-multi-comp` off; set react rules in a local override as shown below.

Change a shared default here only when every consuming repository should follow it.

## Boundary composition

A generated boundary configuration contributes `jsPlugins`, `settings` and `overrides`. In `defineLint` the
overrides apply in the fixed order: shared, then the opt-in checks, then the repository's own, then the
boundary ones — **the boundary overrides are the tail**, so no local override can weaken a generated rule for
the files it matches, and the boundary ones own their rule ids (`boundaries/dependencies`,
`shared-checks/restricted-syntax`, `shared-checks/restricted-imports`, `shared-checks/restricted-globals`)
plus the exact settings keys emitted by the generator. Unrelated `import/*` settings remain available.
A local rule or override rule under an owned id, or a
local setting under an owned settings key, is refused with a named conflict instead of being merged or
overwritten; every other local rule, setting and override is kept. The `missingBoundaryRules` drift check
recomputes the generator output and reports a lint block that lost or reordered the generated parts.

Hand-spreading instead of `defineLint` carries the same contract manually: spread the shared config first,
add the repository's own overrides, and put `...boundary.overrides` last — then keep the drift check in a
repository test, because nothing else enforces the order.

A repository's own restrictions never need the shared namespace: a local `no-restricted-syntax` selector and
a generated one are different rules and both report. Only the generated rules must use `shared-checks/*`,
which is why `defineLint` also refuses two jsPlugins entries that share a name or a file — oxlint keeps only
the first alias of a doubly registered file.

## Duplicate scans

jscpd composes by CLI, not by merging configs. Point `--config` at the profile and keep every repository
ignore, format and root in the command: a CLI option with a non-empty list replaces the profile's array, so
half an ignore list in the profile and half in the command silently loses one half. Relative `path` and
`baseline` fields inside an explicit config resolve from the config file's directory, while CLI roots and
`--output` resolve from the working directory — keep the profile path-free and there is nothing to reconcile.

## Exempting paths

Frameworks decide some file names and exports, and generated or vendored code follows its generator. Exempt such
paths with a local override instead of renaming or splitting them. The snippets use `.oxlintrc.json`; the same
objects go into `overrides` in `oxlint.config.ts` or vite-plus.

File names: route files named after the conventions of Next.js, TanStack Router, Remix and React Router already
pass (see [File rules](decisions.md#file-rules)). For other names a framework or generator decides, turn the rule off
for the directory:

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
default component. Turn `react/no-multi-comp` off for them with an override that also lists the react plugin (the
[`shadcn`](decisions.md#shadcnui) check already does this for shadcn/ui files):

```json
{
  "files": ["app/routes/**/*.tsx", "app/root.tsx"],
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
