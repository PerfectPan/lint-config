import { fileURLToPath } from "node:url";

import { jsPlugins, tailwindRules } from "@perfectpan/lint-config/tailwind";
import { fmt, lint } from "@perfectpan/lint-config/vite-plus";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ...fmt,
    ignorePatterns: ["invalid/**"]
  },
  lint: {
    ...lint,
    jsPlugins: [...jsPlugins],
    overrides: [
      ...lint.overrides,
      {
        files: ["invalid/warning.ts"],
        rules: { "no-console": "warn" }
      },
      {
        files: ["tailwind/**/*.tsx"],
        rules: tailwindRules(fileURLToPath(new URL("tailwind/theme.css", import.meta.url)))
      }
    ]
  }
});
