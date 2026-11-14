/**
 * Boundary lint generator: turns a consumer-owned manifest into the `jsPlugins`, `settings` and
 * `overrides` a Vite+/Oxlint configuration carries. The manifest owns every package, context and
 * path value; this module owns the rule shapes and the composition contract. Plugin specifiers are
 * resolved from the consumer's own installation, and computed entry-export groups are supplied as
 * plain data (no compiler API here).
 */
import { createRequire } from "node:module";
import { join } from "node:path";

import { policiesOf } from "./policies.js";
import { sharedChecksPlugin } from "./shared-plugin.js";
import { elementsOf, fileCategories, sourceScopes } from "./scopes.js";
import { overridesOf } from "./regions.js";
import { ADDITIONAL_DEPENDENCY_NODES } from "./values.js";

function resolveFromRoot(root, name) {
  try {
    return createRequire(join(root, "package.json")).resolve(name);
  } catch {
    throw new Error(
      `Cannot resolve ${name} from the consumer root ${root}; install it (it is an optional peer of @perfectpan/lint-config)`
    );
  }
}

/**
 * Validates the consumer-supplied computed export groups against the manifest's grants: every
 * declared grant needs its group, `all` must be non-empty, `within` must come from `all`, and a
 * whitelist must be a subset of `within` — never merely of `all`, which would admit names whose
 * declarations live outside the protected origins.
 */
function validateEntryExports(manifest, entryGroups) {
  const grants = manifest.computedEntryGrants ?? [];
  if (grants.length === 0) {
    return;
  }
  if (entryGroups === undefined) {
    throw new Error(
      `${manifest.manifestSource}: computed entry grants are declared but no entry export groups were supplied`
    );
  }
  for (const grant of grants) {
    const group = entryGroups[grant.specifier];
    if (group === undefined) {
      throw new Error(
        `${manifest.manifestSource}: computed entry grant ${grant.specifier} has no computed export group; supply entryExports["${grant.specifier}"]`
      );
    }
    if (group.all.length === 0) {
      throw new Error(
        `${manifest.manifestSource}: the computed export group for ${grant.specifier} is empty; the entry layout changed`
      );
    }
    const foreign = group.within.filter((name) => !group.all.includes(name));
    if (foreign.length > 0) {
      throw new Error(
        `${manifest.manifestSource}: the within list for ${grant.specifier} contains names outside its all list: ${foreign.join(", ")}`
      );
    }
    const unknown = (grant.whitelist ?? []).filter((name) => !group.within.includes(name));
    if (unknown.length > 0) {
      throw new Error(
        `${manifest.manifestSource}: whitelist names are not exports of ${grant.specifier} from the declared origins: ${unknown.join(", ")}`
      );
    }
  }
}

/**
 * The generated boundary configuration. Throws with a specific diagnostic when the manifest is
 * inconsistent, a peer dependency is missing, or a declared computed entry grant lacks its data.
 */
export function defineBoundaryLint({ root, manifest, entryExports: entryGroups }) {
  if (typeof root !== "string" || root === "") {
    throw new Error("defineBoundaryLint: root must be the consumer repository's absolute path");
  }
  if (typeof manifest.manifestSource !== "string" || manifest.manifestSource === "") {
    throw new Error("defineBoundaryLint: manifestSource must name the declaring file for diagnostics");
  }
  // An explicitly empty allow set would emit an invalid empty name list at best and, if dropped,
  // would silently widen the permission — reject it at configuration input instead.
  if (manifest.effectSubset !== undefined && manifest.effectSubset.names.length === 0) {
    throw new Error(
      `${manifest.manifestSource}: effectSubset.names must list the exports pure layers may import; an empty list would refuse every effect import`
    );
  }
  if (manifest.typeOnlyEntry !== undefined && manifest.typeOnlyEntry.typeExports.length === 0) {
    throw new Error(
      `${manifest.manifestSource}: typeOnlyEntry.typeExports must list the entry's type exports; an empty list would refuse every import`
    );
  }
  validateEntryExports(manifest, entryGroups);
  const scopes = sourceScopes(manifest);
  const categories = fileCategories(manifest, scopes);
  return {
    jsPlugins: [
      { name: "boundaries", specifier: resolveFromRoot(root, "eslint-plugin-boundaries") },
      sharedChecksPlugin
    ],
    settings: {
      "boundaries/root-path": root,
      "boundaries/elements": elementsOf(scopes),
      "boundaries/files": categories,
      "boundaries/flag-as-external": {
        customSourcePatterns: Object.keys(manifest.packages).flatMap((name) => [name, `${name}/**`])
      },
      "boundaries/dependency-nodes": ["require", "dynamic-import"],
      "boundaries/additional-dependency-nodes": ADDITIONAL_DEPENDENCY_NODES,
      "boundaries/legacy-templates": false,
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: Object.keys(manifest.packages).map((name) => `${manifest.packages[name].directory}/tsconfig.json`)
        }
      }
    },
    overrides: overridesOf(manifest, scopes, entryGroups ?? {})
  };
}

/**
 * The parts of the boundary rules that a lint block lacks. Overrides may precede the boundary ones,
 * but none may follow them, or it could weaken the generated rules for files it matches. Only the
 * settings keys the generator actually writes are compared, so unrelated `import/*` settings a
 * consumer preserves stay out of the check.
 */
export function missingBoundaryRules(lint, options) {
  const boundary = defineBoundaryLint(options);
  const has = (own, expected) =>
    expected.every((item) => own?.some((candidate) => JSON.stringify(candidate) === JSON.stringify(item)) === true);
  const ownedKeys = Object.keys(boundary.settings);
  const settings = Object.fromEntries(
    Object.entries(lint?.settings ?? {}).filter(([key]) => ownedKeys.includes(key))
  );
  return [
    ...(has(lint?.jsPlugins, boundary.jsPlugins) ? [] : ["jsPlugins"]),
    ...(JSON.stringify(settings) === JSON.stringify(boundary.settings) ? [] : ["settings"]),
    ...(JSON.stringify(lint?.overrides?.slice(-boundary.overrides.length)) === JSON.stringify(boundary.overrides)
      ? []
      : ["overrides"])
  ];
}
