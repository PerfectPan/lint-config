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

Tag `vX.Y.Z` on `main` after CI passes, create a GitHub release with short notes, and bump the tag in consumers.
Bump `version` in `package.json` to match the tag.
