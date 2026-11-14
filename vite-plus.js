import fmtConfig from "./oxfmt.json" with { type: "json" };
import lintConfig from "./oxlint.json" with { type: "json" };
import {
  boundaryOwnedRules,
  boundaryOwnedSettingsKeys,
  dataOwnedRules,
  sharedChecksPlugin
} from "./boundaries/shared-plugin.js";
import { structuralGuardSelectors } from "./boundaries/values.js";
import { shadcnOverrides } from "./shadcn/index.js";
import { tailwindOverrides, tailwindPlugins } from "./tailwind/index.js";

// The JSON files are the single source; `$schema` is only meaningful to editors reading the JSON.
const { $schema: _lintSchema, ...lint } = lintConfig;
const { $schema: _fmtSchema, ...fmt } = fmtConfig;

// The structural guards as a standalone opt-in: no package graph or layer model required. The
// consumer lists the files to guard, any narrower local restrictions keep working through their own
// rule ids, and declared traversal paths keep their explicit exception.
function dataBoundariesOverride({ files, excludeFiles, objectWalks }) {
  return {
    files: [...files],
    excludeFiles: [...(excludeFiles ?? []), ...(objectWalks ?? [])],
    rules: { "shared-checks/restricted-syntax": ["error", ...structuralGuardSelectors] }
  };
}

// Merges the repository's config into the shared one: object keys merge key by key, plugins are
// added, and overrides apply in a fixed order (shared, then the opt-in checks, then the
// repository's own, then the boundary ones — a later override wins and the boundary ones must stay
// last so nothing after them can weaken the generated rules).
function defineLint({ tailwind = false, shadcn = false, dataBoundaries = false, boundaries, ...local } = {}) {
  if (boundaries !== undefined && dataBoundaries !== false) {
    throw new Error(
      "defineLint: give boundaries or dataBoundaries, not both — the boundary manifest owns the structural guards and their traversal exceptions"
    );
  }
  const { plugins = [], categories, options, rules = {}, jsPlugins = [], overrides = [], settings = {}, ...rest } = local;
  if (boundaries !== undefined) {
    assertUnowned("boundaries", boundaryOwnedRules, boundaryOwnedSettingsKeys, local);
  } else if (dataBoundaries !== false) {
    assertUnowned("dataBoundaries", dataOwnedRules, [], local);
  }
  const mergedPlugins = [
    ...(tailwind ? tailwindPlugins : []),
    ...jsPlugins,
    ...(dataBoundaries !== false ? [sharedChecksPlugin] : []),
    ...(boundaries?.jsPlugins ?? [])
  ];
  assertDistinctPlugins(mergedPlugins);
  const dataOverride = dataBoundaries === false ? undefined : dataBoundariesOverride(dataBoundaries);
  return {
    ...lint,
    ...rest,
    plugins: [...new Set([...lint.plugins, ...plugins])],
    categories: { ...lint.categories, ...categories },
    options: { ...lint.options, ...options },
    rules: { ...lint.rules, ...rules },
    jsPlugins: mergedPlugins,
    settings: { ...settings, ...(boundaries?.settings ?? {}) },
    overrides: [
      ...lint.overrides,
      ...(tailwind ? tailwindOverrides(tailwind) : []),
      ...(shadcn ? shadcnOverrides(shadcn, rules["no-restricted-imports"]) : []),
      ...(dataOverride ? [dataOverride] : []),
      ...overrides,
      ...(boundaries?.overrides ?? [])
    ]
  };
}

// The generated boundary features own their rule ids and exactly the settings keys they write; a
// local rule or override rule under an owned id, or a local setting under an owned key, would fight
// the generated options, so the conflict is reported instead of resolved silently. Unrelated local
// settings (including any other `import/*` key) are preserved.
function assertUnowned(feature, ownedRules, ownedSettingsKeys, local) {
  const ruleConflicts = Object.keys(local.rules ?? {}).filter((name) => ownedRules.includes(name));
  const overrideConflicts = (local.overrides ?? []).flatMap((override) =>
    Object.keys(override.rules ?? {}).filter((name) => ownedRules.includes(name))
  );
  const settingConflicts = Object.keys(local.settings ?? {}).filter((name) => ownedSettingsKeys.includes(name));
  const conflicts = [
    ...ruleConflicts.map((name) => `rules["${name}"]`),
    ...overrideConflicts.map((name) => `overrides[].rules["${name}"]`),
    ...settingConflicts.map((name) => `settings["${name}"]`)
  ];
  if (conflicts.length > 0) {
    throw new Error(
      `defineLint: the ${feature} feature owns ${conflicts.join(", ")}; drop the local setting or move it into the feature's own configuration`
    );
  }
}

// Registering one plugin file twice under two names loses the second alias, and a duplicated name
// overwrites its predecessor: both are configuration mistakes the merge refuses.
function assertDistinctPlugins(plugins) {
  const names = new Map();
  const specifiers = new Map();
  for (const plugin of plugins) {
    const nameOwner = names.get(plugin.name);
    if (nameOwner !== undefined) {
      throw new Error(`defineLint: the jsPlugins name ${plugin.name} is registered twice (${nameOwner} and ${plugin.specifier})`);
    }
    const specifierOwner = specifiers.get(plugin.specifier);
    if (specifierOwner !== undefined) {
      throw new Error(
        `defineLint: the plugin file ${plugin.specifier} is registered under two names (${specifierOwner} and ${plugin.name}); oxlint would keep only the first alias`
      );
    }
    names.set(plugin.name, plugin.specifier);
    specifiers.set(plugin.specifier, plugin.name);
  }
}

export { defineLint, fmt, lint };
