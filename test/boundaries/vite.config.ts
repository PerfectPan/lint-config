import { fileURLToPath } from "node:url";

import { defineBoundaryLint } from "@perfectpan/lint-config/boundaries";
import { defineLint } from "@perfectpan/lint-config/vite-plus";
import { defineConfig } from "vite-plus";

import { entryExports, manifest } from "./manifest.js";

const boundary = defineBoundaryLint({
  root: fileURLToPath(new URL("./", import.meta.url)),
  manifest,
  entryExports
});

export default defineConfig({
  lint: defineLint({
    // The fixture exercises the generated boundary rules; the type-aware pass and the type check
    // would only add resolution noise for the stubbed externals, so this consumer turns them off.
    options: { typeAware: false, typeCheck: false },
    ignorePatterns: ["node_modules/**"],
    boundaries: boundary
  })
});
