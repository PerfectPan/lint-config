/**
 * Dependency policies for the `boundaries/dependencies` rule, generated per package from the
 * manifest. Evaluation is last-write-wins: the generic refusals come first, the per-scope grants
 * second, and the narrow rejections last — so a declared entry surface cannot be re-opened by an
 * external allowlist entry, and a Node-free scope keeps refusing Node built-ins after every grant.
 */
import { modelLayer, pureLayer } from "./scopes.js";
import { NODE_BUILTINS } from "./values.js";

const NODE_BUILTIN_MESSAGE = "[node-builtin] Node built-ins belong behind the declared IO boundaries";

function elementEntity(scopes, type) {
  const fileScope = scopes.find((scope) => scope.file === true && scope.type === type);
  return fileScope === undefined
    ? { element: { type } }
    : { element: { type: `${fileScope.packageName}:src` }, file: { categories: type } };
}

const localEntity = (scopes, type) => ({ ...elementEntity(scopes, type), module: { origin: "local" } });
const externalEntity = (module = {}) => ({ module: { origin: "external", ...module } });

/** The import surface one package offers its dependents: `root` for the bare specifier, `entries`
 * as exact internalPath globs, and no `entries` at all meaning every subpath is importable. */
function surfacePolicies(scopes, manifest, name, from) {
  const surface = manifest.importableEntries?.[name];
  if (surface === undefined) {
    return [
      { from, allow: { to: externalEntity({ source: name, internalPath: null }) } },
      { from, allow: { to: externalEntity({ source: name, internalPath: "**" }) } }
    ];
  }
  const policies = [];
  if (surface.root === true) {
    policies.push({ from, allow: { to: externalEntity({ source: name, internalPath: null }) } });
  }
  if (surface.entries === undefined) {
    policies.push({ from, allow: { to: externalEntity({ source: name, internalPath: "**" }) } });
  } else {
    for (const entry of surface.entries) {
      policies.push({ from, allow: { to: externalEntity({ source: name, internalPath: entry }) } });
    }
  }
  return policies;
}

/** The package-wide rejections for declared entry surfaces, applied after every grant. */
function surfaceRestrictions(manifest, fromAny) {
  return Object.keys(manifest.importableEntries ?? {}).flatMap((name) => {
    const surface = manifest.importableEntries[name];
    const disallow = [];
    if (surface.root !== true) {
      disallow.push(externalEntity({ source: name, internalPath: null }));
    }
    if (surface.entries !== undefined && surface.entries.length > 0) {
      disallow.push(externalEntity({ source: name, internalPath: `!(${surface.entries.join("|")})` }));
      if (!surface.entries.some((entry) => entry.endsWith("/**"))) {
        disallow.push(externalEntity({ source: name, internalPath: "*/**" }));
      }
    } else if (surface.entries !== undefined) {
      // An explicitly empty entry list declares that nothing of this package is importable.
      disallow.push(externalEntity({ source: name, internalPath: "**" }));
    }
    if (disallow.length === 0) {
      return [];
    }
    const declared = surface.entries ?? [];
    const message =
      declared.length > 0 && surface.root === true
        ? `[deep-import] {{dependency.source}}: import the ${name} root entry or a declared subpath (${declared.map((entry) => `${name}/${entry.replaceAll("/**", "")}`).join(", ")})`
        : declared.length > 0
          ? `[deep-import] {{dependency.source}}: import the exact ${name}/${declared[0].replaceAll("/**", "")} entry`
          : surface.entries === undefined
            ? `[deep-import] {{dependency.source}}: import a ${name} subpath export; the package has no root barrel`
            : surface.root === true
              ? `[deep-import] {{dependency.source}}: import the ${name} root entry; the package publishes no subpath`
              : `[deep-import] {{dependency.source}}: the ${name} package exposes no importable surface`;
    return [{ from: fromAny, disallow: { to: disallow }, message }];
  });
}

/**
 * The policies of one package: forbidden defaults, per-scope grants, declared-surface rejections,
 * and the trailing Node refusal for scopes without the Node capability.
 */
export function policiesOf(manifest, scopes, packageName) {
  const rule = manifest.packages[packageName];
  const fromAny = { element: { type: `${packageName}:*` } };

  const forbidden = [
    {
      from: fromAny,
      disallow: { to: NODE_BUILTINS },
      message: NODE_BUILTIN_MESSAGE
    },
    {
      from: fromAny,
      disallow: { to: externalEntity() },
      message: `[external-dependency] {{dependency.source}}: not in the external allowlist of ${packageName}, which lists exact specifiers (${manifest.manifestSource})`
    },
    {
      from: fromAny,
      disallow: { to: externalEntity({ source: Object.keys(manifest.packages) }) },
      message: `[package-dependency] {{dependency.source}}: ${packageName} may not depend on {{to.module.source}} (see ${manifest.manifestSource})`
    },
    {
      from: fromAny,
      disallow: { to: localEntity(scopes, `${packageName}:*`) },
      message: "[layer] {{dependency.source}}: {{from.element.type}} may not import {{to.element.type}}"
    },
    {
      from: fromAny,
      disallow: {
        to: [
          { element: { type: `!${packageName}:*` }, module: { origin: "local" } },
          { element: { isUnknown: true }, module: { origin: "local" } }
        ]
      },
      message: `[relative-escape] {{dependency.source}}: leaves ${packageName}; import another package by its name`
    },
    {
      from: fromAny,
      disallow: { to: { element: { isUnknown: true, path: null }, module: { origin: "local" } } },
      message: "[unresolved] {{dependency.source}}: the import resolver found no file"
    }
  ];

  const allowed = scopes
    .filter((scope) => scope.packageName === packageName)
    .flatMap((scope) => {
      const entity = elementEntity(scopes, scope.type);
      const externals = rule.external.filter(
        (specifier) => scope.external === true || (scope.external !== false && scope.external.includes(specifier))
      );
      const upstream =
        scope.context === undefined
          ? scope.rootLayer === undefined
            ? []
            : Object.keys(manifest.contexts[packageName] ?? {})
          : (manifest.contexts[packageName]?.[scope.context]?.dependsOn ?? []);
      const typeOnly = scope.layer === "domain" || scope.layer === "adapters" || scope.layer === "lib";
      return [
        ...(scope.nodeBuiltins ? [{ from: entity, allow: { to: NODE_BUILTINS } }] : []),
        ...(scope.imports.length === 0 ? [] : [{ from: entity, allow: { to: scope.imports.map((type) => localEntity(scopes, type)) } }]),
        ...(rule.sharedLib !== undefined && scope.context !== undefined && scope.layer !== "public"
          ? [{ from: entity, allow: { to: localEntity(scopes, `${packageName}:lib`) } }]
          : []),
        ...upstream.map((context) => ({
          from: entity,
          allow: {
            to: localEntity(scopes, `${packageName}:${context}:public`),
            ...(typeOnly ? { dependency: { kind: "type" } } : {})
          }
        })),
        ...(externals.length === 0
          ? []
          : [{ from: entity, allow: { to: externalEntity(), dependency: { source: [...externals] } } }]),
        ...(manifest.typeOnlyEntry !== undefined && (modelLayer(scope) || pureLayer(scope))
          ? [
              {
                from: entity,
                allow: {
                  to: externalEntity({
                    source: manifest.typeOnlyEntry.source,
                    internalPath: manifest.typeOnlyEntry.internalPath
                  }),
                  dependency: { kind: "type" }
                }
              }
            ]
          : []),
        ...scope.workspace.flatMap((name) => surfacePolicies(scopes, manifest, name, entity)),
        ...(scope.nodeBuiltins === false
          ? [{ from: entity, disallow: { to: NODE_BUILTINS }, message: NODE_BUILTIN_MESSAGE }]
          : [])
      ];
    });
  // A Node-free catch-all `src` scope appends its refusal with an element-wide `from`, which also
  // covers the package's entry files — those are file categories inside the same element. Re-grant
  // the Node capability to the Node-capable file categories after every scope policy, so the more
  // specific grant wins while the real Node-free scopes stay fail-closed.
  const nodeCapableFileGrants = scopes
    .filter((scope) => scope.packageName === packageName && scope.file === true && scope.nodeBuiltins === true)
    .map((scope) => ({
      from: elementEntity(scopes, scope.type),
      allow: { to: NODE_BUILTINS }
    }));

  const restricted = [
    ...surfaceRestrictions(manifest, fromAny),
    // Package entry files are importable only from outside their package.
    {
      from: fromAny,
      disallow: {
        to: {
          element: { type: `${packageName}:*` },
          file: { categories: "entry" },
          module: { origin: "local" }
        }
      },
      message: "[entry] {{dependency.source}}: package entry files are re-export surfaces, not internal modules"
    }
  ];

  return [...forbidden, ...allowed, ...nodeCapableFileGrants, ...restricted];
}
