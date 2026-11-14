import type { BoundaryManifest } from "@perfectpan/lint-config/boundaries";

/**
 * The fixture's boundary declaration: package and context names, directories, paths and whitelists
 * that deliberately differ from any real consumer, proving the shared generator carries no hidden
 * assumptions about its first consumer's layout.
 */
export const manifest: BoundaryManifest = {
  manifestSource: "manifest.ts",
  sourceFiles: ["packages/*/src/**/*.ts"],
  testFiles: ["**/*.test.ts"],
  packages: {
    "@acme/core": {
      directory: "packages/core",
      shape: "flat",
      dependsOn: [],
      external: [],
      nodeBuiltins: false
    },
    "@acme/void": {
      directory: "packages/void",
      shape: "flat",
      dependsOn: [],
      external: []
    },
    "@acme/api": {
      directory: "packages/api",
      shape: "scoped",
      dependsOn: ["@acme/core"],
      external: ["effect", "@acme/sdk", "node:fs"],
      sharedLib: { pattern: "src/lib", external: [], workspace: [] },
      pureWorkspace: ["@acme/core"]
    }
  },
  contexts: {
    "@acme/core": {},
    "@acme/api": {
      billing: { dependsOn: [] },
      shipping: { dependsOn: ["billing"] }
    }
  },
  contextLayers: {
    domain: { imports: ["domain", "lib"], external: false },
    adapters: { imports: ["domain", "adapters", "lib"], external: ["effect"] },
    application: { imports: ["domain", "adapters", "application", "lib"], external: ["effect"] },
    infra: { imports: ["domain", "adapters", "application", "infra", "lib"], external: true },
    lib: { imports: ["domain", "adapters", "lib"], external: ["effect"] }
  },
  rootLayerNames: ["bootstrap", "entry"],
  rootLayers: {
    "@acme/api": {
      bootstrap: {
        pattern: "src/bootstrap",
        imports: ["bootstrap"],
        external: true,
        nodeBuiltins: true,
        lib: true,
        workspace: ["@acme/core"]
      },
      entry: {
        pattern: "",
        imports: ["bootstrap"],
        external: true,
        nodeBuiltins: true,
        workspace: ["@acme/core"]
      }
    }
  },
  packageEntries: {
    "@acme/core": ["src/index.ts"],
    "@acme/api": ["src/cli.ts"]
  },
  pureProjections: ["packages/core/src/index.ts", "packages/core/src/pure-case.ts"],
  noExportStarEntries: ["packages/api/src/cli.ts", "packages/core/src/export-star-case.ts"],
  locatedSpecifiers: {
    "@acme/sdk": ["packages/api/src/billing/infra/**", "packages/api/src/bootstrap/**"]
  },
  locatedCalls: {
    effectRunners: ["packages/api/src/bootstrap/**"],
    computedImports: ["packages/api/src/billing/infra/loader.ts"],
    createRequire: ["packages/api/src/billing/infra/loader.ts"]
  },
  importableEntries: {
    "@acme/core": { root: true, entries: ["values"] },
    "@acme/void": { root: false, entries: [] }
  },
  computedEntryGrants: [
    { specifier: "@acme/core", consumerPackage: "@acme/api", whitelist: ["CoreValue"] }
  ],
  effectSubset: { names: ["Schema", "Result"] },
  typeOnlyEntry: { source: "@acme/core", internalPath: "values", typeExports: ["Outcome"] },
  structuralGuards: { objectWalks: ["packages/api/src/lib/**"] },
  schemaDecodeGuards: true,
  forbiddenGlobals: {
    pureLayers: ["process", "console"],
    packages: { "@acme/core": ["process", "console", "Buffer"] }
  }
};

/**
 * The computed export groups of the restricted `@acme/core` entry. The fixture supplies them as
 * plain data (its TypeScript has no Program API and needs none): the entry exports three names, two
 * of them declared inside the protected origins.
 */
export const entryExports = {
  "@acme/core": { all: ["CoreValue", "CoreHelper", "coreInfraSecret"], within: ["CoreValue", "CoreHelper"] }
};
