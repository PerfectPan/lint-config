import { defineBoundaryLint } from "@perfectpan/lint-config/boundaries";
import { fileURLToPath } from "node:url";

const boundary = defineBoundaryLint({
  root: fileURLToPath(new URL("./", import.meta.url)),
  manifest: {
    manifestSource: "oxlint.config.mjs",
    sourceFiles: ["packages/*/src/**/*.ts"],
    testFiles: ["**/*.test.ts"],
    packages: {
      "@fixture/core": { directory: "packages/core", shape: "flat", dependsOn: ["@fixture/lib"], external: [], nodeBuiltins: false },
      "@fixture/lib": { directory: "packages/lib", shape: "flat", dependsOn: [], external: [] }
    },
    contexts: {},
    contextLayers: {
      domain: { imports: ["domain", "lib"], external: false },
      adapters: { imports: ["domain", "adapters", "lib"], external: [] },
      application: { imports: ["domain", "adapters", "application", "lib"], external: [] },
      infra: { imports: ["domain", "adapters", "application", "infra", "lib"], external: true },
      lib: { imports: ["domain", "adapters", "lib"], external: [] }
    },
    rootLayerNames: [],
    rootLayers: {},
    packageEntries: {},
    importableEntries: { "@fixture/lib": { root: true } },
    pureProjections: [],
    noExportStarEntries: [],
    locatedSpecifiers: {},
    structuralGuards: {}
  }
});

export default {
  categories: { correctness: "error" },
  options: { typeAware: false, typeCheck: false },
  jsPlugins: boundary.jsPlugins,
  settings: boundary.settings,
  overrides: boundary.overrides
};
