#!/usr/bin/env bash
set -euo pipefail

title="${1:-}"
allowed_types="feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert"
pattern="^(${allowed_types})(\\([a-z0-9._-]+\\))?!?: [^[:space:]].*"

if [[ -z "${title//[[:space:]]/}" ]]; then
  printf 'check-pr-title: missing PR title\n' >&2
  exit 1
fi

if [[ ! "$title" =~ $pattern ]]; then
  printf 'check-pr-title: title must match type(scope): summary\n' >&2
  printf 'check-pr-title: allowed types: %s\n' "$allowed_types" >&2
  printf 'check-pr-title: got: %s\n' "$title" >&2
  exit 1
fi

printf 'check-pr-title: ok\n'
