# Decisions

Why each shared setting and opt-in check is what it is. Record the reason for a new rule or flag here.

## Lint

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
- **`no-use-before-define`:** a `const`, `let`, `var`, `class`, `enum` or `function` declaration in any scope —
  including an arrow-function constant and a name in an `export { name }` list — must not be referenced above its
  declaration, so a file reads top-down and the reader meets a name's definition before its use. Function
  declarations are checked too: they hoist, but a single reading order for every kind of name (helpers above their
  callers, the entry at the bottom) was chosen over the "entry first, helpers below" order that hoisting allows.
  TypeScript already rejects a direct top-level read in the temporal dead zone (TS2448–TS2450); this rule also
  catches references inside function bodies, which only fail at runtime when the function runs before the
  declaration. The cost of checking functions is that two functions that call each other cannot both be declared
  first: keep one `// oxlint-disable-next-line no-use-before-define` with the reason on it, or restructure (for
  example by passing one function to the other). Type-only references stay allowed through the default
  `ignoreTypeReferences`.
- **`promise/valid-params` is off:** it counts the arguments of any method named `then`, `catch` or `finally` without
  type information, so it reports APIs that only share the name, such as zod/mini's `z.catch(schema, fallback)`.
  TypeScript already rejects a wrong argument count on a real Promise method (TS2554), and oxlint's rule page notes
  the rule "is generally unnecessary if using TypeScript". Leaving it on forced an `oxlint-disable` comment at every
  such call.

## File rules

Three rules constrain files rather than code: kebab-case names, at most 1000 lines, and one component per component
file. They keep files easy to find and short. [Exempting paths](overrides.md#exempting-paths) shows how a repository
opts directories out, for example framework route files.

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
  own `.jsx`/`.tsx` override (see [Exempting paths](overrides.md#exempting-paths) for why that override lists the
  plugin).

## Format

`oxfmt.json` is the default style for new repositories. An existing repository may override the quote, semicolon
and trailing-comma options to avoid reformatting its whole history; for example agent-trace keeps `semi: false`,
`singleQuote: true` and `trailingComma: "all"`.

- `printWidth: 120`: fewer wrapped lines for TypeScript signatures and template strings.
- `trailingComma: "none"`.
- `sortPackageJson: false`: `package.json` keeps its hand-written field order.

## TypeScript

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

## Opt-in checks

### Tailwind CSS

oxlint has no Tailwind rules of its own, so these come from `eslint-plugin-better-tailwindcss` through oxlint's
`jsPlugins`. They are opt-in because only repositories with a Tailwind front end need them and the plugin; a
repository that leaves `tailwind` off neither loads nor installs it. The plugin compiles a stylesheet to learn the
theme, which is why each stylesheet is configured with its own files.

- **`no-unknown-classes`, `no-conflicting-classes`, `no-duplicate-classes`, `no-unnecessary-whitespace`,
  `enforce-canonical-classes`:** a class the theme does not define, two classes setting the same property, a repeated
  class, stray whitespace, and a longer spelling of a class that has a canonical form (`bg-[#fff]` for `bg-white`).
  Each one either does nothing or does something other than what the markup says.
- **`no-concatenated-classes`:** Tailwind finds classes by scanning source text, so a class built from fragments
  (`"text-" + tone`) generates no CSS. Write complete class strings and choose between them in code.
- **`no-restricted-classes` on literal values:** an arbitrary value containing a hex colour, a colour function
  (`rgb()`, `hsl()`, `oklch()` and the rest) or a `px`, `rem` or `em` length is reported. Such a value bypasses the
  theme, so the same colour or size drifts across files; add a token to the theme's `@theme` and use its utility.
  Arbitrary values without a literal, such as `data-[state=on]:`, `max-w-[62ch]` or `bg-(--color-brand)`, pass. It
  is on by default so that a new repository starts without literal values; a repository with many existing ones sets
  `literalValues: false` while it adds tokens.
- **Class order is not enforced:** `enforce-consistent-class-order` would rewrite most existing markup, and the
  formatter does not sort classes.

### shadcn/ui

The check is independent of `tailwind` and uses oxlint's own rules. It keeps controls in the shadcn/ui files listed
in `ui`:

- **`react/forbid-elements` outside `ui`:** the elements listed in `elements` (for example `["button"]`) may only be
  rendered by the shadcn/ui files, so focus styles, variants and accessibility fixes live in one component. The
  repository lists only the elements whose shadcn/ui component it has installed. Test files are excluded, using the
  test globs of the shared react override, which turns `react/forbid-elements` off; this override comes after it.
- **`no-restricted-imports` outside `ui`:** Radix primitives (`@radix-ui/*` and the `radix-ui` package) are imported
  only by the shadcn/ui files that wrap them. `@radix-ui/react-slot` stays allowed everywhere, because `Slot` is a
  composition helper for `asChild`, not a control. An override's `no-restricted-imports` would replace the top-level
  setting for the files it matches, so `defineLint` adds the Radix pattern to the repository's own top-level
  `no-restricted-imports` options.
- **`react/no-multi-comp` off in `ui`:** a shadcn/ui file holds a component and its parts.
