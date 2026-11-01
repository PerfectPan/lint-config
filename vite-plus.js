import fmtConfig from "./oxfmt.json" with { type: "json" };
import lintConfig from "./oxlint.json" with { type: "json" };
import { shadcnOverrides } from "./shadcn/index.js";
import { tailwindOverrides, tailwindPlugins } from "./tailwind/index.js";

// The JSON files are the single source; `$schema` is only meaningful to editors reading the JSON.
const { $schema: _lintSchema, ...lint } = lintConfig;
const { $schema: _fmtSchema, ...fmt } = fmtConfig;

// Merges the repository's config into the shared one: object keys merge key by key, plugins are added, and overrides
// apply in a fixed order (shared, then the opt-in checks, then the repository's own), because a later override wins and
// the shared react override turns react/forbid-elements off.
function defineLint({ tailwind = false, shadcn = false, ...local } = {}) {
  const { plugins = [], categories, options, rules = {}, jsPlugins = [], overrides = [], ...rest } = local;
  return {
    ...lint,
    ...rest,
    plugins: [...new Set([...lint.plugins, ...plugins])],
    categories: { ...lint.categories, ...categories },
    options: { ...lint.options, ...options },
    rules: { ...lint.rules, ...rules },
    jsPlugins: [...(tailwind ? tailwindPlugins : []), ...jsPlugins],
    overrides: [
      ...lint.overrides,
      ...(tailwind ? tailwindOverrides(tailwind) : []),
      ...(shadcn ? shadcnOverrides(shadcn, rules["no-restricted-imports"]) : []),
      ...overrides
    ]
  };
}

export { defineLint, fmt, lint };
