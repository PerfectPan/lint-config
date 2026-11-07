#!/usr/bin/env bash
# Runs the floors fixture in test/floors against the shared configs.
# Every dependency there is pinned to the lowest version in package.json's peerDependencies, so a floor
# that stops working (a version gone from npm, a config the old tool cannot load) fails here before a
# consumer hits it. Install the fixture first: `pnpm test:floors` does it, or `pnpm install` inside test/floors.
set -euo pipefail

cd "$(dirname "$0")/../test/floors"
bin=./node_modules/.bin
failures=0

expect_pass() {
  local name="$1"
  shift
  local output
  if output="$("$@" 2>&1)"; then
    printf 'ok    %s\n' "$name"
  else
    printf 'FAIL  %s (expected success)\n%s\n' "$name" "$output"
    failures=$((failures + 1))
  fi
}

expect_fail() {
  local name="$1" pattern="$2"
  shift 2
  local output
  if output="$("$@" 2>&1)"; then
    printf 'FAIL  %s (expected failure)\n%s\n' "$name" "$output"
    failures=$((failures + 1))
  elif grep -qF -- "$pattern" <<<"$output"; then
    printf 'ok    %s\n' "$name"
  else
    printf 'FAIL  %s (missing "%s")\n%s\n' "$name" "$pattern" "$output"
    failures=$((failures + 1))
  fi
}

# The smoke only proves the floors when the fixture really runs them: every devDependency must be
# installed at exactly the version pinned in package.json.
check_pinned_versions() {
  node --input-type=module -e '
    import { readFileSync } from "node:fs";

    const { devDependencies } = JSON.parse(readFileSync("package.json", "utf8"));
    const wrong = [];
    for (const [name, expected] of Object.entries(devDependencies)) {
      if (name === "@perfectpan/lint-config") continue;
      const actual = JSON.parse(readFileSync(`node_modules/${name}/package.json`, "utf8")).version;
      if (actual !== expected) {
        wrong.push(`${name}: installed ${actual}, pinned ${expected}`);
      }
    }
    if (wrong.length > 0) {
      console.error(`not installed at the pinned floor:\n${wrong.join("\n")}`);
      process.exit(1);
    }
  '
}

if ! node -e 'require("./node_modules/@perfectpan/lint-config/package.json")' 2>/dev/null; then
  printf 'FAIL  @perfectpan/lint-config is not installed; run `pnpm install` in test/floors first\n'
  exit 1
fi
expect_pass "fixture: every dependency installed at its pinned floor" check_pinned_versions

# oxlint floor: the shared config loads in the floor oxlint and its rules report.
expect_pass "oxlint: clean source" "$bin/oxlint" -c oxlintrc.json src
expect_fail "oxlint: unused variable" "no-unused-vars" "$bin/oxlint" -c oxlintrc.json invalid/unused-var.ts

# oxlint-tsgolint floor: the shared typeAware and typeCheck options run on it, both the type-aware
# rules and the TypeScript diagnostics forwarded into the lint pass.
expect_fail "oxlint: type-aware rule (no-unnecessary-condition)" "no-unnecessary-condition" "$bin/oxlint" -c oxlintrc.json invalid/unnecessary-condition.ts
expect_fail "oxlint: type check (noUncheckedIndexedAccess)" "TS2532" "$bin/oxlint" -c oxlintrc.json invalid/unchecked-index.ts

# oxfmt floor: the shared format options load and check.
expect_pass "oxfmt: shared json" "$bin/oxfmt" -c node_modules/@perfectpan/lint-config/oxfmt.json --check src

# typescript floor: the shared tsconfig extends through the package exports and its strict flags report.
expect_pass "tsc: shared base tsconfig" "$bin/tsc" -p tsc/base.json
expect_fail "tsc: noUncheckedIndexedAccess" "TS2532" "$bin/tsc" -p tsc/invalid.json

# vite-plus floor: defineLint's output runs through the floor vp, which uses the project's own oxlint
# (vite-plus 0.2.x bundles an older one; see docs/decisions.md).
expect_pass "vite-plus lint: clean source" "$bin/vp" lint src
expect_fail "vite-plus lint: unused variable" "no-unused-vars" "$bin/vp" lint invalid/unused-var.ts

# eslint-plugin-better-tailwindcss floor: the tailwind opt-in check loads through defineLint's jsPlugins
# and the rules compile the fixture stylesheet.
expect_pass "tailwind: theme tokens and allowed arbitrary values" "$bin/vp" lint tailwind/badge.tsx
expect_fail "tailwind: unknown class" "better-tailwindcss(no-unknown-classes)" "$bin/vp" lint tailwind/invalid/unknown-class.tsx

expect_pass "vite-plus fmt: clean source" "$bin/vp" fmt --check src

if ((failures > 0)); then
  printf '\n%d check(s) failed\n' "$failures"
  exit 1
fi
printf '\nall checks passed\n'
