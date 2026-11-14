/**
 * Region overrides: every file of every package is covered by exactly one override per generated
 * rule, because an oxlint override replaces a rule's options wholesale. Regions are nested or
 * disjoint directory/file globs sorted most-specific first; explicit exclusions keep the groups
 * disjoint. Generated rules use the shared `shared-checks` namespace so the overrides can never
 * erase (or be erased by) a consumer's native restrictions.
 */
import { matchesGlob } from "node:path";

import { policiesOf } from "./policies.js";
import { modelLayer, pureLayer, scopeOf } from "./scopes.js";
import {
  createRequireSelectors,
  dynamicImportSelectors,
  effectRunnerSelectors,
  effectSubsetSelectors,
  escapeRegExp,
  modelSchemaSelectors,
  pinnedEntryAccessSelectors,
  pureProjectionSelectors,
  structuralGuardSelectors,
  typeOnlyEntrySelectors,
  undeclaredSourceSelector
} from "./values.js";

const matchesAnyPath = (filePath, globs) => globs.some((glob) => matchesGlob(filePath, glob));

function allowedSpecifiersOf(manifest, filePath) {
  const allowed = new Set();
  for (const [specifier, paths] of Object.entries(manifest.locatedSpecifiers)) {
    if (matchesAnyPath(filePath, paths)) {
      allowed.add(specifier);
    }
  }
  return allowed;
}

/** The located-specifier patterns a file group must carry: every pinned specifier the group's paths
 * do not grant. The pattern also admits subpaths, so a pinned package subpath stays where the
 * manifest pins it. */
function bannedLocatedPatterns(manifest, allowed) {
  return Object.keys(manifest.locatedSpecifiers)
    .filter((specifier) => !allowed.has(specifier))
    .sort()
    .map((specifier) => ({
      regex: `^${escapeRegExp(specifier).replaceAll("\\*", ".*")}(/.+)?$`,
      message: `[sdk-location] ${specifier} (or a subpath of it) is pinned to the paths declared in ${manifest.manifestSource}`
    }));
}

/** Regions are nested or disjoint directory/file globs. The last matching region supplies all rule
 * options; explicit exclusions keep the override groups disjoint even though oxlint replaces
 * options wholesale. */
export function ruleRegions(manifest, scopes) {
  const locatedCalls = manifest.locatedCalls ?? {};
  return [
    ...new Set([
      ...scopes.map(({ pattern, file }) => (file === true ? pattern : `${pattern}/**`)),
      ...Object.values(manifest.locatedSpecifiers).flat(),
      ...(locatedCalls.effectRunners ?? []),
      ...(locatedCalls.computedImports ?? []),
      ...(locatedCalls.createRequire ?? []),
      ...(manifest.structuralGuards?.objectWalks ?? []),
      ...manifest.pureProjections,
      ...manifest.noExportStarEntries
    ])
  ].sort((left, right) => left.replaceAll("*", "").length - right.replaceAll("*", "").length);
}

export function representative(pattern) {
  return pattern.replaceAll("**", "__probe__").replaceAll("*", "__probe__");
}

/**
 * The computed-entry tier of a scope: the consumer package's model and pure layers may import only
 * the grant whitelist, its application layers may import the names the consumer's export analysis
 * placed inside the declared origins. Returns the grant plus its tier, or undefined.
 */
function entryGrantsOf(manifest, scope) {
  if (scope === undefined) {
    return [];
  }
  const grants = manifest.computedEntryGrants ?? [];
  const own = grants.filter((grant) => grant.consumerPackage === scope.packageName);
  if (own.length === 0) {
    return [];
  }
  if (modelLayer(scope) || pureLayer(scope)) {
    return own.map((grant) => ({ grant, tier: "whitelist" }));
  }
  if (scope.layer === "application") {
    return own.map((grant) => ({ grant, tier: "computed" }));
  }
  return [];
}

const globalsRule = (names) => [
  "error",
  {
    globals: names.map((name) => ({ name, message: `[domain-global] the ${name} global does not belong in this layer` })),
    checkGlobalObject: true
  }
];

const importsRule = (patterns) => ["error", { patterns }];

/** Overrides for one generated configuration: the dependency-policy override plus one per region. */
export function overridesOf(manifest, scopes, entryGroups) {
  const locatedCalls = manifest.locatedCalls ?? {};
  const objectWalks = manifest.structuralGuards?.objectWalks ?? [];
  const overrides = [
    {
      files: [...manifest.sourceFiles],
      excludeFiles: [...manifest.testFiles],
      plugins: ["import"],
      rules: {
        "boundaries/dependencies": [
          "error",
          {
            default: "disallow",
            checkAllOrigins: true,
            checkUnknownLocals: true,
            // Package entries and context public.ts files are file categories inside their package's
            // `src` element, so imports among them are internal to one element; without this they
            // would bypass every policy.
            checkInternals: true,
            policies: Object.keys(manifest.packages).flatMap((packageName) =>
              policiesOf(manifest, scopes, packageName)
            )
          }
        ]
      }
    }
  ];
  const regions = ruleRegions(manifest, scopes);
  for (const [index, region] of regions.entries()) {
    const probe = representative(region);
    const scope = scopeOf(scopes, probe);
    const grants = entryGrantsOf(manifest, scope);
    const patterns = bannedLocatedPatterns(manifest, allowedSpecifiersOf(manifest, probe));
    const grantPatterns = [];
    for (const { grant, tier } of grants) {
      const group = entryGroups[grant.specifier];
      // An omitted or empty whitelist on the model/pure tier allows nothing — it must never inherit
      // the application tier's computed origins.
      const whitelist = tier === "whitelist" ? (grant.whitelist ?? []) : undefined;
      // An empty banned-name set is legitimate: every export is allowed for this tier, and the rule
      // schema refuses an empty name list, so the pattern is simply not emitted.
      const importNames = group.all.filter((name) =>
        whitelist !== undefined ? !whitelist.includes(name) : !group.within.includes(name)
      );
      if (importNames.length === 0) {
        continue;
      }
      grantPatterns.push({
        regex: `^${escapeRegExp(grant.specifier)}$`,
        importNames,
        message:
          tier === "whitelist"
            ? `[runtime-entry] {{importSource}} is not in the domain allowlist of the computed entry grant (${manifest.manifestSource})`
            : "[runtime-entry] this name is not a domain/application export of the computed entry; the allowlist comes from the consumer's export analysis"
      });
    }
    if (pureLayer(scope) && manifest.effectSubset !== undefined) {
      patterns.push({
        regex: "^effect$",
        allowImportNames: [...manifest.effectSubset.names],
        message: "[domain-effect] only the declared effect subset belongs in domain adapters and lib"
      });
    }
    if (manifest.typeOnlyEntry !== undefined && (modelLayer(scope) || pureLayer(scope))) {
      patterns.push({
        regex: `^${escapeRegExp(`${manifest.typeOnlyEntry.source}/${manifest.typeOnlyEntry.internalPath}`)}$`,
        allowImportNames: [...manifest.typeOnlyEntry.typeExports],
        message: `[utils-result] only the ${manifest.typeOnlyEntry.typeExports.join(", ")} type belongs in domain and pure library layers`
      });
    }
    const syntax = [
      ...(scope?.type.endsWith(":src") === true && manifest.packages[scope.packageName].shape === "scoped"
        ? [undeclaredSourceSelector]
        : []),
      ...(matchesAnyPath(probe, locatedCalls.computedImports ?? []) ? [] : dynamicImportSelectors),
      ...(matchesAnyPath(probe, locatedCalls.createRequire ?? []) ? [] : createRequireSelectors(manifest.manifestSource)),
      ...(matchesAnyPath(probe, locatedCalls.effectRunners ?? []) || scope?.layer === "infra"
        ? []
        : effectRunnerSelectors(manifest.manifestSource)),
      ...grants.flatMap(({ grant }) => pinnedEntryAccessSelectors(grant.specifier)),
      ...(pureLayer(scope) && manifest.effectSubset ? effectSubsetSelectors(manifest.effectSubset.names) : []),
      ...(manifest.typeOnlyEntry !== undefined && (modelLayer(scope) || pureLayer(scope))
        ? typeOnlyEntrySelectors(`${manifest.typeOnlyEntry.source}/${manifest.typeOnlyEntry.internalPath}`)
        : []),
      ...((modelLayer(scope) || scope?.layer === "application") && manifest.schemaDecodeGuards === true
        ? modelSchemaSelectors
        : []),
      // Production code outside the explicitly declared traversal tools; a domain adapter is not a
      // traversal tool and keeps the guards.
      ...(manifest.structuralGuards === undefined || matchesAnyPath(probe, objectWalks)
        ? []
        : structuralGuardSelectors),
      ...[...patterns, ...grantPatterns]
        .filter((pattern) => pattern.importNames === undefined && pattern.allowImportNames === undefined)
        .map((pattern) => ({
          selector: `TSImportType > Literal[value=/${pattern.regex.replaceAll("/", "\\/")}/]`,
          message: pattern.message
        })),
      ...(matchesAnyPath(probe, manifest.pureProjections)
        ? pureProjectionSelectors
        : matchesAnyPath(probe, manifest.noExportStarEntries)
          ? pureProjectionSelectors.slice(0, 1)
          : [])
    ];
    const globals =
      manifest.forbiddenGlobals?.packages?.[scope?.packageName ?? ""] !== undefined
        ? manifest.forbiddenGlobals.packages[scope.packageName]
        : modelLayer(scope) || pureLayer(scope)
          ? manifest.forbiddenGlobals?.pureLayers
          : undefined;
    overrides.push({
      files: [region],
      excludeFiles: [...manifest.testFiles, ...regions.slice(index + 1)],
      plugins: ["import"],
      rules: {
        "shared-checks/restricted-imports": importsRule([...patterns, ...grantPatterns]),
        "shared-checks/restricted-syntax": ["error", ...syntax],
        ...(globals !== undefined ? { "shared-checks/restricted-globals": globalsRule(globals) } : {})
      }
    });
  }
  return overrides;
}
