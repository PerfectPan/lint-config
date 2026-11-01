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
