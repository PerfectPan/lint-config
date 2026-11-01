import { fileURLToPath } from "node:url";

import { defineLint, fmt } from "@perfectpan/lint-config/vite-plus";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ...fmt,
    ignorePatterns: ["invalid/**"]
  },
  lint: defineLint({
    tailwind: {
      stylesheets: [
        { entryPoint: fileURLToPath(new URL("tailwind/theme.css", import.meta.url)), files: ["tailwind/**/*.tsx"] }
      ]
    },
    shadcn: { ui: ["shadcn/components/ui/*.tsx"], elements: ["button"] },
    rules: {
      "no-restricted-imports": ["error", { paths: [{ name: "node:fs", message: "Read files through the loader." }] }]
    },
    overrides: [
      {
        files: ["invalid/warning.ts"],
        rules: { "no-console": "warn" }
      }
    ]
  })
});
