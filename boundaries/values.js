/**
 * Static rule values of the boundary generator: the AST selector families and dependency-node
 * declarations every consumer shares. Messages stay neutral (no repository paths or private links)
 * and every diagnostic starts with its rule tag in brackets, which downstream lint cases match on.
 * Manifest-selected values (specifiers, whitelists, exception paths) are passed in by the caller
 * from `selectors.js` builders; nothing here knows a consumer's package or context names.
 */

/** An `from` entity that matches every element of one package. */
const anyElementOf = (packageName) => ({ element: { type: `${packageName}:*` } });

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A Node built-in module, whatever its spelling (`node:fs` and the bare `fs` forms). */
const NODE_BUILTINS = [{ module: { origin: "core" } }, { module: { origin: "external", source: "node:*" } }];

/** The plugin's default import/export nodes judge declaration-level kinds. Inline `type` specifiers
 * need disjoint selectors too, so an all-type import is legal without allowing a mixed value import. */
const INLINE_TYPE_IMPORT =
  "ImportDeclaration:has(> ImportSpecifier):not(:has(> ImportSpecifier[importKind!='type'])):not(:has(> ImportDefaultSpecifier)):not(:has(> ImportNamespaceSpecifier))";
const INLINE_TYPE_EXPORT =
  "ExportNamedDeclaration:has(> ExportSpecifier):not(:has(> ExportSpecifier[exportKind!='type']))";

/** Dependency nodes the boundaries plugin must judge beyond its defaults: every TS import and
 * re-export spelling, split into type and value kinds. */
const ADDITIONAL_DEPENDENCY_NODES = [
  {
    selector: `ImportDeclaration[importKind='type'] > Literal , ${INLINE_TYPE_IMPORT} > Literal`,
    kind: "type",
    name: "import"
  },
  {
    selector: `ImportDeclaration[importKind!='type']:not(${INLINE_TYPE_IMPORT}) > Literal`,
    kind: "value",
    name: "import"
  },
  {
    selector: `ExportNamedDeclaration[exportKind='type'] > Literal , ${INLINE_TYPE_EXPORT} > Literal , ExportAllDeclaration[exportKind='type'] > Literal`,
    kind: "type",
    name: "export"
  },
  {
    selector: `ExportNamedDeclaration[exportKind!='type']:not(${INLINE_TYPE_EXPORT}) > Literal , ExportAllDeclaration[exportKind!='type'] > Literal`,
    kind: "value",
    name: "export"
  },
  { selector: "TSImportType > Literal", kind: "type", name: "import-type" },
  {
    selector: "TSImportEqualsDeclaration[importKind='type'] > TSExternalModuleReference > Literal",
    kind: "type",
    name: "import-equals"
  },
  {
    selector: "TSImportEqualsDeclaration[importKind!='type'] > TSExternalModuleReference > Literal",
    kind: "value",
    name: "import-equals"
  }
];

/** Selector families, each an array of `{selector, message}` options for the shared restricted-syntax
 * rule. `manifestSource` names the declaring file in diagnostics. */

const dynamicImportSelectors = [
  {
    selector: "ImportExpression[source.type!='Literal']",
    message: "[dynamic-import] dynamic import() needs a string literal specifier so that the import graph can be checked"
  }
];

const createRequireSelectors = (manifestSource) => [
  {
    selector: "CallExpression[callee.name='createRequire'] , CallExpression[callee.property.name='createRequire']",
    message: `[create-require] createRequire is pinned to the paths declared in ${manifestSource}`
  }
];

const effectRunnerSelectors = (manifestSource) => [
  {
    selector: "CallExpression[callee.object.name=/^(Effect|ManagedRuntime)$/][callee.property.name=/^run/]",
    message: `[effect-runner] Effect runners are pinned to the paths declared in ${manifestSource}`
  },
  {
    selector: "CallExpression[callee.object.name='ManagedRuntime'][callee.property.name='make']",
    message: `[effect-runner] ManagedRuntime is pinned to the paths declared in ${manifestSource}`
  }
];

/** Syntax forms through which a pinned entry must never be reached. A literal dynamic import or a
 * type query over the root specifier or any of its subpaths is refused, while namespace and default
 * imports are refused only for the exact root — its subpaths stay location-pinned and judged there.
 * Static named imports stay legal and are judged by the computed name lists. The specifier is the
 * literal module name; the regex form escapes and anchors it internally. */
const pinnedEntryAccessSelectors = (specifier) => {
  // The selector regex literal cannot contain an unescaped slash, so the literal specifier's own
  // separators and the module-boundary lookahead's slash are escaped before anchoring; an adjacent
  // package name sharing the prefix (`@acme/core-tools`) never matches.
  const subpathRegex = `^${escapeRegExp(specifier).replaceAll("/", "\\/")}(?=$|\\/)`;
  return [
    {
      selector: `ImportExpression[source.value=/${subpathRegex}/] , TSImportType > Literal[value=/${subpathRegex}/]`,
      message:
        "[runtime-entry] reach the pinned root entry through a named static import, and its subpaths from their declared locations"
    },
    {
      selector: `ImportDeclaration[source.value='${specifier}'] > ImportNamespaceSpecifier , ImportDeclaration[source.value='${specifier}'] > ImportDefaultSpecifier`,
      message: "[runtime-entry] import the pinned root entry by name; the allowlist judges named imports"
    }
  ];
};

/** Pure layers may import the declared effect subset only by name: no whole-module namespace, no
 * default import, no dynamic or star form. */
const effectSubsetSelectors = (names) => [
  {
    selector:
      "ImportExpression[source.value='effect'] , TSImportType > Literal[value='effect'] , ImportDeclaration[source.value='effect'] > ImportNamespaceSpecifier , ImportDeclaration[source.value='effect'] > ImportDefaultSpecifier , ExportAllDeclaration[source.value='effect']",
    message: `[domain-effect] import ${names.join(", ")} by name`
  }
];

/** Pure layers import or re-export the declared type-only entry only as an explicit type. */
const typeOnlyEntrySelectors = (specifier) => [
  {
    selector: `ImportDeclaration[source.value='${specifier}']:not([importKind='type']):not(${INLINE_TYPE_IMPORT}) , ExportNamedDeclaration[source.value='${specifier}']:not([exportKind='type']):not(${INLINE_TYPE_EXPORT})`,
    message: `[utils-result] pure layers import or re-export ${specifier} only as an explicit type`
  },
  {
    selector: `ImportDeclaration[source.value='${specifier}'] > ImportDefaultSpecifier , ImportDeclaration[source.value='${specifier}'] > ImportNamespaceSpecifier , ExportAllDeclaration[source.value='${specifier}'] , ImportExpression[source.value='${specifier}'] , TSImportType > Literal[value='${specifier}'] , TSImportEqualsDeclaration > TSExternalModuleReference > Literal[value='${specifier}'] , CallExpression[callee.name='require'][arguments.0.value='${specifier}']`,
    message: `[utils-result] pure layers use a named static type import from the exact ${specifier} entry`
  }
];

// Decoding and judging calls only; `decodeTo`/`encodeTo` combinators and `isInt`-style checks stay
// legal. The member selector knows only the names Schema and SchemaParser, so renaming them on
// import is refused too. The `effect/Schema` and `effect/SchemaParser` subpaths are not in the
// package specifier allowlist at all.
const modelSchemaSelectors = [
  {
    selector:
      "CallExpression[callee.object.name=/^(Schema|SchemaParser)$/][callee.property.name=/^((decode|decodeUnknown|encode|encodeUnknown)(Effect|Exit|Option|Promise|Result|Sync)|is|asserts)$/]",
    message: "[model-decode] model layers hold no decoding or validation calls; decode belongs at the data boundary"
  },
  {
    selector:
      "ImportDeclaration[source.value='effect'] > ImportSpecifier[imported.name='Schema'][local.name!='Schema'] , ImportDeclaration[source.value='effect'] > ImportSpecifier[imported.name='SchemaParser'][local.name!='SchemaParser']",
    message: "[model-decode] import Schema and SchemaParser under their own names so the decode ban can see them"
  }
];

// An is-it-an-object predicate is a data-boundary decision, not a spelling ban: a loose
// typeof-object comparison walks unknown data, a renamed isRecord predicate hides a failed decode,
// and a wide Record(String, Unknown) predicate accepts anything. Decode the whole shape with one
// Schema at the entry instead; declared traversal tools keep their explicit exception.
const structuralGuardSelectors = [
  {
    selector:
      "BinaryExpression[operator=/^[!=]==?$/][left.operator='typeof'][right.value='object'] , BinaryExpression[operator=/^[!=]==?$/][right.operator='typeof'][left.value='object']",
    message:
      "[structural-guard] decode unknown data at its entry and narrow known unions by their members; typeof-object walks belong in declared traversal tools"
  },
  {
    selector:
      ":matches(FunctionDeclaration, VariableDeclarator)[id.name=/^(isRecord|asRecord|isJsonObject|isObjectRecord)$/] , CallExpression[callee.object.name='Schema'][callee.property.name='is'][arguments.0.callee.object.name='Schema'][arguments.0.callee.property.name='Record'][arguments.0.arguments.0.property.name='String'][arguments.0.arguments.1.property.name='Unknown']",
    message:
      "[structural-guard] an is-it-an-object predicate is a renamed isRecord; decode the whole shape with one Schema"
  }
];

const pureProjectionSelectors = [
  { selector: "ExportAllDeclaration", message: "[entry-export] list re-exported names instead of export *" },
  {
    selector: "Program > :not(ExportNamedDeclaration):not(ExportAllDeclaration) , Program > ExportNamedDeclaration[source=null]",
    message: "[entry-purity] a package entry only re-exports names from their owners"
  }
];

/** The fail-closed selector for a scoped package's undeclared top-level source. */
const undeclaredSourceSelector = {
  selector: "Program",
  message: "[undeclared-source] declare the owning context or root layer before adding source"
};

export {
  ADDITIONAL_DEPENDENCY_NODES,
  NODE_BUILTINS,
  anyElementOf,
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
};
