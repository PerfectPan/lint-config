// Structural declarations for the boundary generator: the manifest stays consumer-owned, the
// generator owns the rule shapes. No compiler API and no consumer toolchain types are imported, so
// the declarations stay assignable across vite-plus, oxlint and TypeScript versions.

/** Per-context import rule: same-package contexts this context may import through `public.ts`. */
export interface ContextRule {
  dependsOn: readonly string[];
}

/** The layer directories every context shares; `external` narrows the package's npm specifiers. */
export type ContextLayerName = "domain" | "adapters" | "application" | "infra" | "lib";

export interface ContextLayerRule {
  imports: readonly ContextLayerName[];
  external: boolean | readonly string[];
}

/**
 * One workspace package. `flat` packages cover their whole source tree with one element; `scoped`
 * packages declare contexts and root layers over a fail-closed default. `directory` is the
 * repository-relative package folder; no name prefix is stripped.
 */
export interface PackageRule {
  directory: string;
  shape: "flat" | "scoped";
  dependsOn: readonly string[];
  external: readonly string[];
  /** Flat packages only: whether the source element may import Node built-ins. */
  nodeBuiltins?: boolean;
  /** Scoped packages only: the package's shared pure-library element. */
  sharedLib?: {
    pattern: string;
    external: boolean | readonly string[];
    /** The shared library element's own workspace permission; never inherited by the contexts. */
    workspace: readonly string[];
  };
  /** Scoped packages only: what the pure context layers (domain, adapters, lib) may import. */
  pureWorkspace?: readonly string[];
}

/** A non-context root layer of a scoped package, located by its `pattern` under the package. */
export interface RootLayerRule {
  pattern: string;
  imports: readonly string[];
  external: boolean | readonly string[];
  nodeBuiltins: boolean;
  /** May import the package's shared-library element. */
  lib?: boolean;
  workspace: readonly string[];
}

/** The import surface one package offers its dependents: the bare specifier (`root`), exact
 * internalPath globs (`entries`), or every subpath when `entries` is omitted. */
export interface ImportableEntries {
  root: boolean;
  entries?: readonly string[];
}

/** Paths granted a located call capability; elsewhere the generated syntax rule refuses it. */
export interface LocatedCalls {
  effectRunners?: readonly string[];
  computedImports?: readonly string[];
  createRequire?: readonly string[];
}

/** A restricted entry whose name allowlist is computed from the consumer's export analysis. Model
 * and pure layers of `consumerPackage` may import only `whitelist`; its application layers may
 * import the names the analysis placed `within` the declared origins. */
export interface ComputedEntryGrant {
  /** The literal module specifier of the restricted root entry, e.g. `@acme/core`. */
  specifier: string;
  consumerPackage: string;
  whitelist?: readonly string[];
}

/** The computed export names of one restricted entry, keyed by the grant's literal `specifier`. */
export interface EntryExportGroup {
  /** Every name the entry exports. */
  all: readonly string[];
  /** Names whose declarations the consumer's analysis places inside the protected origins. */
  within: readonly string[];
}

/** The pure layers' named-only import subset of `effect`. */
export interface EffectSubset {
  names: readonly string[];
}

/** The exact entry pure and model layers may import as explicit types only. */
export interface TypeOnlyEntry {
  source: string;
  internalPath: string;
  typeExports: readonly string[];
}

/** The consumer-owned boundary declaration. Every package, context, path and whitelist value lives
 * here; the generator owns the rules built from it. */
export interface BoundaryManifest {
  /** The declaring file, quoted in generated diagnostics. */
  manifestSource: string;
  /** All package source files, matched by the dependency-policy override. */
  sourceFiles: readonly string[];
  /** Test files the generated rules never judge. */
  testFiles: readonly string[];
  packages: Record<string, PackageRule>;
  contexts: Record<string, Record<string, ContextRule>>;
  contextLayers: Record<ContextLayerName, ContextLayerRule>;
  rootLayerNames: readonly string[];
  rootLayers: Record<string, Partial<Record<string, RootLayerRule>>>;
  packageEntries: Record<string, readonly string[]>;
  /** Entry files that must stay a pure list of named re-exports. */
  pureProjections: readonly string[];
  /** Entry files where `export *` is refused, beyond the pure projections. */
  noExportStarEntries: readonly string[];
  /** Import specifiers whose use is pinned to these repository-relative path globs. */
  locatedSpecifiers: Record<string, readonly string[]>;
  locatedCalls?: LocatedCalls;
  importableEntries?: Record<string, ImportableEntries>;
  computedEntryGrants?: readonly ComputedEntryGrant[];
  effectSubset?: EffectSubset;
  typeOnlyEntry?: TypeOnlyEntry;
  /** Refuse loose object walks and isRecord-style predicates outside these explicitly declared
   * traversal paths; there is no implicit layer exemption, so a repository keeps its lib paths here. */
  structuralGuards?: {
    objectWalks?: readonly string[];
  };
  /** Model and application layers hold no decoding or validation calls. */
  schemaDecodeGuards?: boolean;
  forbiddenGlobals?: {
    pureLayers?: readonly string[];
    packages?: Record<string, readonly string[]>;
  };
}

/** The lint block parts a boundary configuration contributes. Arrays stay mutable so consumers can
 * compose the values directly into their own configuration objects; the literal plugin and rule
 * value types keep the output assignable to the consumer's own Oxlint configuration types. */
export interface BoundaryLint {
  jsPlugins: Array<{ name: string; specifier: string }>;
  settings: Record<string, unknown>;
  overrides: Array<{
    files: string[];
    excludeFiles?: string[];
    plugins?: Array<"import">;
    rules: Record<string, "error" | ["error", ...unknown[]]>;
  }>;
}

/** Options shared by the generator and the drift check: the same root, manifest and computed
 * export groups the consumer composed its lint block from. */
export interface BoundaryOptions {
  /** The consumer repository's absolute root, where the optional peers are resolved. */
  root: string;
  manifest: BoundaryManifest;
  /** Computed export groups keyed by the grants' specifiers; required when grants are declared. */
  entryExports?: Record<string, EntryExportGroup>;
}

/** A lint block, as the drift check reads it. */
export interface BoundaryLintLike {
  jsPlugins?: readonly unknown[] | null;
  settings?: Record<string, unknown> | null;
  overrides?: readonly unknown[] | null;
}

/**
 * The generated boundary configuration. Throws with a specific diagnostic when the manifest is
 * inconsistent, a peer dependency is missing from the consumer's installation, or a declared
 * computed entry grant lacks its computed export group.
 */
export declare function defineBoundaryLint(options: BoundaryOptions): BoundaryLint;

/**
 * The parts of the boundary rules that a lint block lacks: missing or changed plugins or settings,
 * and boundary overrides that are not exactly the tail of the override list. Returns the offending
 * part names; an empty list means the consumer carries the generated rules in full.
 */
export declare function missingBoundaryRules(lint: BoundaryLintLike | null | undefined, options: BoundaryOptions): string[];
