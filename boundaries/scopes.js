/**
 * Element and scope computation for the boundary generator. The manifest decides which packages are
 * `flat` (one element covering the whole source tree) and which are `scoped` (declared contexts and
 * root layers over a fail-closed default). Nothing here knows a consumer's package or directory
 * names; every path comes from the manifest.
 */
import { matchesGlob } from "node:path";

/** The fixed context-layer vocabulary of the generator: `src/<context>/<layer>/` directories, plus
 * the external-format adapters nested inside domain (`src/<context>/domain/<concept>/adapters/`). */
export const CONTEXT_LAYERS = ["adapters", "domain", "application", "infra", "lib"];

/**
 * The first matching scope owns a file. Nested domain adapters and explicit entries are declared
 * before their parents, so a deeper rule wins over its directory.
 *
 * @returns {Array<object>} scopes in match order
 */
export function sourceScopes(manifest) {
  const packageNames = Object.keys(manifest.packages);
  return packageNames.flatMap((packageName) => {
    const rule = manifest.packages[packageName];
    const base = `${rule.directory}/src`;
    const contextScopes = Object.keys(manifest.contexts[packageName] ?? {}).flatMap((context) => [
      ...CONTEXT_LAYERS.map((layer) => ({
        packageName,
        type: `${packageName}:${context}:${layer}`,
        pattern: layer === "adapters" ? `${base}/${context}/domain/*/adapters` : `${base}/${context}/${layer}`,
        context,
        layer,
        imports: manifest.contextLayers[layer].imports.map((target) => `${packageName}:${context}:${target}`),
        external: manifest.contextLayers[layer].external,
        // The pure layers' workspace permission is declared per package (`pureWorkspace`); a shared
        // library's own permissions never flow into the contexts that may import it.
        workspace:
          layer === "domain" || layer === "adapters" || layer === "lib"
            ? (rule.pureWorkspace ?? [])
            : rule.dependsOn,
        nodeBuiltins: layer === "infra"
      })),
      {
        packageName,
        type: `${packageName}:${context}:public`,
        pattern: `${base}/${context}/public.ts`,
        file: true,
        context,
        layer: "public",
        imports: CONTEXT_LAYERS.map((layer) => `${packageName}:${context}:${layer}`),
        external: false,
        workspace: [],
        nodeBuiltins: false
      }
    ]);
    if (rule.shape === "flat") {
      return [
        ...contextScopes,
        {
          packageName,
          type: `${packageName}:src`,
          pattern: base,
          imports: [`${packageName}:src`],
          external: true,
          workspace: rule.dependsOn,
          nodeBuiltins: rule.nodeBuiltins === true
        }
      ];
    }
    const roots = manifest.rootLayerNames.flatMap((layer) => {
      const layerRule = manifest.rootLayers[packageName]?.[layer];
      if (layerRule === undefined) {
        return [];
      }
      const common = {
        packageName,
        type: `${packageName}:${layer}`,
        rootLayer: layer,
        imports: [
          ...layerRule.imports.map((target) => `${packageName}:${target}`),
          ...(layerRule.lib ? [`${packageName}:lib`] : [])
        ],
        external: layerRule.external,
        workspace: layerRule.workspace,
        nodeBuiltins: layerRule.nodeBuiltins
      };
      if (layer === "entry") {
        return (manifest.packageEntries[packageName] ?? []).map((entry) => ({
          ...common,
          pattern: `${rule.directory}/${entry}`,
          file: true
        }));
      }
      return [{ ...common, pattern: `${rule.directory}/${layerRule.pattern}` }];
    });
    return [
      ...contextScopes,
      ...roots,
      ...(rule.sharedLib
        ? [
            {
              packageName,
              type: `${packageName}:lib`,
              pattern: `${rule.directory}/${rule.sharedLib.pattern}`,
              imports: [`${packageName}:lib`],
              external: rule.sharedLib.external,
              workspace: rule.sharedLib.workspace,
              nodeBuiltins: false
            }
          ]
        : []),
      {
        packageName,
        type: `${packageName}:src`,
        pattern: base,
        imports: [],
        external: false,
        workspace: [],
        nodeBuiltins: false
      }
    ];
  });
}

/** The `boundaries/elements` descriptors: directory scopes; file scopes are categories instead. */
export function elementsOf(scopes) {
  return scopes
    .filter(({ file }) => file !== true)
    .map(({ type, pattern }) => ({
      type,
      pattern,
      partialMatch: false,
      exclusive: true
    }));
}

/** The `boundaries/files` categories: package entry files plus the manifest's file scopes. */
export function fileCategories(manifest, scopes) {
  const entryFiles = Object.keys(manifest.packages).flatMap((packageName) =>
    (manifest.packageEntries[packageName] ?? []).map((entry) => `${manifest.packages[packageName].directory}/${entry}`)
  );
  return [
    ...entryFiles.map((pattern) => ({ category: "entry", pattern })),
    ...scopes
      .filter(({ file }) => file === true)
      .map(({ type, pattern }) => ({ category: type, pattern }))
  ];
}

export function scopeOf(scopes, filePath) {
  return scopes.find(({ pattern, file }) => matchesGlob(filePath, file === true ? pattern : `${pattern}/**`));
}

export const modelLayer = (scope) => scope?.layer === "domain";

/** Pure layers may not run effects, decode, or touch Node globals: adapters, per-context libraries,
 * and a declared package-shared library. */
export const pureLayer = (scope) =>
  scope?.layer === "adapters" || scope?.layer === "lib" || scope?.type?.endsWith(":lib") === true;
