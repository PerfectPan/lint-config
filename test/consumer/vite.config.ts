import { fileURLToPath } from "node:url";

import { defineLint, fmt } from "@perfectpan/lint-config/vite-plus";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ...fmt,
    ignorePatterns: [...fmt.ignorePatterns, "invalid/**"]
  },
  lint: defineLint({
    tailwind: {
      stylesheets: [
        { entryPoint: fileURLToPath(new URL("tailwind/theme.css", import.meta.url)), files: ["tailwind/**/*.tsx"] }
      ]
    },
    shadcn: { ui: ["shadcn/components/ui/*.tsx"], elements: ["button"] },
    jsPlugins: [{ name: "local-checks", specifier: fileURLToPath(new URL("./local-plugin.mjs", import.meta.url)) }],
    dataBoundaries: {
      files: ["data-boundary/**"],
      objectWalks: ["data-boundary/walker.ts"]
    },
    rules: {
      "no-restricted-imports": ["error", { paths: [{ name: "node:fs", message: "Read files through the loader." }] }],
      "local-checks/restricted-syntax": ["error", { selector: "EmptyStatement", message: "LOCAL-SENTINEL" }]
    },
    overrides: [
      {
        files: ["invalid/warning.ts"],
        rules: { "no-console": "warn" }
      }
    ]
  })
});
