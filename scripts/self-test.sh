#!/usr/bin/env bash
# Runs the consumer fixture in test/consumer against the shared configs.
# Each negative case must fail with a specific diagnostic, so a config that silently
# stops applying (for example a broken `extends`) cannot pass by accident.
set -euo pipefail

cd "$(dirname "$0")/../test/consumer"
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

check_lint() {
  local label="$1"
  shift
  expect_pass "$label: clean source" "$@" src
  expect_fail "$label: unused variable" "no-unused-vars" "$@" invalid/unused-var.ts
  expect_fail "$label: unbraced if body" "eslint(curly)" "$@" invalid/unbraced-if.ts
  expect_fail "$label: type check (noUncheckedIndexedAccess)" "TS2532" "$@" invalid/unchecked-index.ts
  expect_fail "$label: denyWarnings" "no-console" "$@" invalid/warning.ts
  expect_fail "$label: unused disable directive" "Unused oxlint-disable directive" "$@" invalid/unused-directive.ts
  expect_fail "$label: file name not kebab-case" "unicorn(filename-case)" "$@" invalid/badName.ts
  expect_fail "$label: source file over 1000 lines" "eslint(max-lines)" "$@" tmp/long-source.ts
  expect_pass "$label: test file over 1000 lines" "$@" tmp/long-source.test.ts
  expect_fail "$label: two components in one .tsx" "react(no-multi-comp)" "$@" invalid/two-components.tsx
}

# Enabling the react plugin in an override also enables its rules in every category the repository turns on,
# and several of them misfire on Solid. The override must turn off every react rule except react/no-multi-comp;
# this fails when an oxlint upgrade adds a react rule the override does not list yet.
check_react_override() {
  node --input-type=module -e '
    import { execFileSync } from "node:child_process";
    import { readFileSync } from "node:fs";

    const config = JSON.parse(readFileSync("node_modules/@perfectpan/lint-config/oxlint.json", "utf8"));
    const { rules } = config.overrides.find((override) => override.plugins?.includes("react"));
    const listed = JSON.parse(execFileSync("node_modules/.bin/oxlint", ["--rules", "-f", "json"], { encoding: "utf8" }));
    const missing = listed
      .filter(({ scope, value }) => scope === "react" && value !== "no-multi-comp")
      .map(({ value }) => `react/${value}`)
      .filter((name) => rules[name] !== "off");
    if (missing.length > 0) {
      console.error(`not turned off in the react override: ${missing.join(", ")}`);
      process.exit(1);
    }
  '
}

# Two identical 1001-line files, one named as a test. Generated so that the fixture stays short.
mkdir -p tmp
for i in $(seq 1 1001); do
  printf 'export const value%d = %d;\n' "$i" "$i"
done >tmp/long-source.ts
cp tmp/long-source.ts tmp/long-source.test.ts

check_lint "oxlint .oxlintrc.json extends" "$bin/oxlint" -c oxlintrc.json
check_lint "oxlint oxlint.config.ts extends" "$bin/oxlint" -c oxlint-package.config.ts
check_lint "vite-plus lint" "$bin/vp" lint
expect_pass "react override turns off every react rule except no-multi-comp" check_react_override

expect_pass "oxfmt shared json" "$bin/oxfmt" -c node_modules/@perfectpan/lint-config/oxfmt.json --check src
expect_pass "oxfmt oxfmt.config.ts" "$bin/oxfmt" -c oxfmt-package.config.ts --check src
expect_pass "vite-plus fmt" "$bin/vp" fmt --check src
expect_fail "oxfmt defaults differ from fixture" "Format issues found" "$bin/oxfmt" -c oxfmt-defaults.json --check src

for variant in base node bundler; do
  expect_pass "tsc tsconfig/$variant.json" "$bin/tsc" -p "tsc/$variant.json"
  expect_fail "tsc tsconfig/$variant.json strict flags" "TS2532" "$bin/tsc" -p "tsc/$variant.strict.json"
done

expect_pass "tsc consumer config files (vite-plus.d.ts types)" "$bin/tsc" -p tsc/config-files.json

if ((failures > 0)); then
  printf '\n%d check(s) failed\n' "$failures"
  exit 1
fi
printf '\nall checks passed\n'
