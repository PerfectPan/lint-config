# Agent Guidelines

This repository holds shared lint, format and tsconfig settings consumed by other repositories through a git tag.
A change here changes every consumer's CI once they bump the tag.

## Rules

- Keep project-specific settings (ignore paths, import boundaries, extra categories) out of the shared files; they
  belong in the consuming repository.
- `oxlint.json` and `oxfmt.json` are the only source of values. `vite-plus.js` re-exports them; `vite-plus.d.ts`
  describes the same data and must be updated with them.
- Record the reason for any new rule or flag in `README.md` under Decisions.
- Do not commit local config, credentials, internal hostnames or machine-specific paths.

## Commands

```bash
pnpm install
pnpm test                                  # scripts/self-test.sh against test/consumer
./scripts/check-pr-title.sh "feat(oxlint): enable suspicious category"
```

## Releases

Releases are manual and pushed straight to `main`; the maintainer asks for them. Pick the version by the rule in
README Versioning: a new or stricter error, a higher peer floor or a removed export is a minor bump while on `0.x`;
fixes, looser rules and docs are a patch.

1. `pnpm test` passes, with a self-test case that fails without the change.
2. For a new or stricter rule, measure the impact read-only on each consumer: run oxlint with only the changed rules
   over its source and record hits per rule and file.
3. Bump `version` in `package.json` and the `#vX.Y.Z` in README's install examples; update `vite-plus.d.ts` and README
   Decisions with the change.
4. Commit, push `main`, and wait for CI on that commit (`gh run watch`).
5. `git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z`, then `gh release create vX.Y.Z --title vX.Y.Z` with
   notes covering what changed, what newly fails and how to exempt it, the impact counts from step 2, and the upgrade
   line (`#vOLD` to `#vX.Y.Z`, then reinstall).

Done when `git rev-list -n1 vX.Y.Z` is the pushed commit, its CI run succeeded, and `gh release view vX.Y.Z` shows
the notes. Then bump PerfectPan/project-template-rush (`packages/example` and `scripts` package.json, `rush update`,
`npm run check`) and open one adoption PR per other consumer; vite-plus consumers must spread `...lint.overrides`
before their own overrides.
