// Composition and drift assertions for the boundary generator, run by self-test.sh against the
// fixture manifest. Every case must fail loudly, so a broken merge or a drifted configuration
// cannot pass by accident.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { defineBoundaryLint, missingBoundaryRules } from "@perfectpan/lint-config/boundaries";
import { defineLint } from "@perfectpan/lint-config/vite-plus";

import { entryExports, manifest } from "./manifest.ts";

const root = fileURLToPath(new URL("./", import.meta.url));
const boundary = defineBoundaryLint({ root, manifest, entryExports });
const config = defineLint({ ignorePatterns: ["node_modules/**"], boundaries: boundary });

// The composed lint block carries the generated rules in full: the drift check is quiet.
assert.deepEqual(missingBoundaryRules(config, { root, manifest, entryExports }), [], "composed config drifts");

// Removing one generated override, appending a local override behind the boundary ones, changing a
// setting, or swapping a plugin must each be reported.
const withoutLast = { ...config, overrides: config.overrides.slice(0, -1) };
assert.deepEqual(missingBoundaryRules(withoutLast, { root, manifest, entryExports }), ["overrides"]);

const withFollower = {
  ...config,
  overrides: [...config.overrides, { files: ["packages/api/src/**"], rules: { curly: "off" } }]
};
assert.deepEqual(missingBoundaryRules(withFollower, { root, manifest, entryExports }), ["overrides"]);

const withChangedSetting = { ...config, settings: { ...config.settings, "import/resolver": {} } };
assert.deepEqual(missingBoundaryRules(withChangedSetting, { root, manifest, entryExports }), ["settings"]);

const withChangedPlugin = { ...config, jsPlugins: config.jsPlugins.slice(1) };
assert.deepEqual(missingBoundaryRules(withChangedPlugin, { root, manifest, entryExports }), ["jsPlugins"]);

// Giving both features is refused: the boundary manifest owns the structural guards.
assert.throws(
  () => defineLint({ boundaries: boundary, dataBoundaries: { files: ["src/**"] } }),
  /boundaries or dataBoundaries/
);

// A local rule under an id the generator owns is refused instead of silently overridden.
assert.throws(
  () => defineLint({ boundaries: boundary, rules: { "shared-checks/restricted-syntax": "off" } }),
  /owns rules\["shared-checks\/restricted-syntax"\]/
);
assert.throws(
  () =>
    defineLint({
      boundaries: boundary,
      overrides: [{ files: ["src/**"], rules: { "boundaries/dependencies": "off" } }]
    }),
  /owns overrides\[\].rules\["boundaries\/dependencies"\]/
);
assert.throws(
  () => defineLint({ boundaries: boundary, settings: { "boundaries/root-path": "/tmp" } }),
  /owns settings\["boundaries\/root-path"\]/
);
// Ownership covers exactly the keys the generator writes: another import/* setting is preserved.
const preserved = defineLint({ boundaries: boundary, settings: { "import/parsers": { ".ts": "./parser.mjs" } } });
assert.deepEqual(preserved.settings["import/parsers"], { ".ts": "./parser.mjs" });
assert.deepEqual(missingBoundaryRules(preserved, { root, manifest, entryExports }), []);

// A grant whose whitelist covers every export bans nothing: no pattern with an empty name list may
// be emitted, because the rule schema rejects empty arrays. The whitelist must stay inside `within`,
// so the all-covering grant also needs an origin-covering `within`.
const allAllowed = {
  ...manifest,
  computedEntryGrants: [{ specifier: "@acme/core", consumerPackage: "@acme/api", whitelist: ["CoreValue", "CoreHelper"] }]
};
const permissive = defineBoundaryLint({
  root,
  manifest: allAllowed,
  entryExports: { "@acme/core": { all: ["CoreValue", "CoreHelper", "coreInfraSecret"], within: ["CoreValue", "CoreHelper", "coreInfraSecret"] } }
});
for (const override of permissive.overrides) {
  const patterns = override.rules?.["shared-checks/restricted-imports"]?.[1]?.patterns ?? [];
  for (const pattern of patterns) {
    for (const key of ["importNames", "allowImportNames"]) {
      assert.ok(!Array.isArray(pattern[key]) || pattern[key].length > 0, `empty ${key} in ${override.files}`);
    }
  }
}

// An omitted or explicitly empty whitelist on the model/pure tier allows nothing: the banned list
// covers every export instead of inheriting the application tier's computed origins.
for (const whitelist of [undefined, []]) {
  const unlisted = defineBoundaryLint({
    root,
    manifest: { ...manifest, computedEntryGrants: [{ specifier: "@acme/core", consumerPackage: "@acme/api", whitelist }] },
    entryExports
  });
  const patterns = unlisted.overrides
    .flatMap((override) => override.rules?.["shared-checks/restricted-imports"]?.[1]?.patterns ?? [])
    .filter(
      (pattern) =>
        pattern.regex === "^@acme/core$" &&
        typeof pattern.message === "string" &&
        pattern.message.includes("domain allowlist")
    );
  assert.ok(patterns.length > 0, "the entry name restriction is missing");
  for (const pattern of patterns) {
    assert.deepEqual(
      [...pattern.importNames].sort(),
      ["CoreHelper", "CoreValue", "coreInfraSecret"],
      "the model tier must ban every export when no whitelist is declared"
    );
  }
}

// An explicitly empty entry list is a whole-surface refusal: every internalPath is banned with a
// valid pattern and the diagnostic says so, without an empty negation glob.
const voidPolicies = boundary.overrides[0].rules["boundaries/dependencies"][1].policies;
const voidRestrictions = voidPolicies.filter((policy) => policy.message?.includes("@acme/void"));
assert.ok(voidRestrictions.length > 0, "the void surface restriction is missing");
for (const policy of voidRestrictions) {
  const to = policy.disallow?.to;
  if (to === undefined) {
    continue;
  }
  const targets = (Array.isArray(to) ? to : [to]).map((entity) => entity.module?.internalPath).filter(Boolean);
  assert.ok(!targets.some((glob) => glob.startsWith("!(")), `empty negation glob in ${JSON.stringify(targets)}`);
  assert.ok(!targets.some((glob) => glob === "!()"), "no empty negation glob");
}
assert.ok(
  voidRestrictions.some((policy) => {
    const to = policy.disallow?.to;
    const entities = Array.isArray(to) ? to : to === undefined ? [] : [to];
    return entities.some((entity) => entity.module?.internalPath === "**");
  }),
  "an empty entry list must ban every subpath"
);
assert.ok(
  voidRestrictions.some((policy) => policy.message.includes("exposes no importable surface")),
  "the void refusal keeps its own diagnostic"
);

// An explicitly empty allow set is a configuration error, not a silently widened permission.
assert.throws(
  () => defineBoundaryLint({ root, manifest: { ...manifest, effectSubset: { names: [] } }, entryExports }),
  /effectSubset\.names must list/
);
assert.throws(
  () => defineBoundaryLint({ root, manifest: { ...manifest, typeOnlyEntry: { ...manifest.typeOnlyEntry, typeExports: [] } }, entryExports }),
  /typeOnlyEntry\.typeExports must list/
);

// A standalone structural-guard opt-in needs no boundary plugin and keeps the local plugins.
const standalone = defineLint({
  jsPlugins: [{ name: "local-checks", specifier: "./local-plugin.mjs" }],
  dataBoundaries: { files: ["data-boundary/**"], objectWalks: ["data-boundary/walker.ts"] }
});
assert.deepEqual(
  standalone.jsPlugins.map((plugin) => plugin.name),
  ["local-checks", "shared-checks"]
);
const standaloneOverride = standalone.overrides.at(-1);
assert.deepEqual(standaloneOverride.files, ["data-boundary/**"]);
assert.deepEqual(standaloneOverride.excludeFiles, ["data-boundary/walker.ts"]);
assert.ok(Object.keys(standaloneOverride.rules)[0].startsWith("shared-checks/"));
assert.equal(Object.keys(standalone.settings).length, 0);

// Registering one plugin file twice, or one name twice, is refused: oxlint keeps only the first.
assert.throws(
  () =>
    defineLint({
      dataBoundaries: { files: ["src/**"] },
      jsPlugins: [{ name: "shared-checks", specifier: "./elsewhere.mjs" }]
    }),
  /registered twice/
);
assert.throws(
  () =>
    defineLint({
      dataBoundaries: { files: ["src/**"] },
      jsPlugins: [{ name: "mine", specifier: standalone.jsPlugins.find((p) => p.name === "shared-checks").specifier }]
    }),
  /two names/
);

console.log("composition checks passed");
