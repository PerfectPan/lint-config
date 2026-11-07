import { fileURLToPath } from "node:url";

import { defineLint, fmt } from "@perfectpan/lint-config/vite-plus";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ...fmt,
    ignorePatterns: ["invalid/**", "tailwind/invalid/**"]
  },
  lint: defineLint({
    tailwind: {
      stylesheets: [
        { entryPoint: fileURLToPath(new URL("tailwind/theme.css", import.meta.url)), files: ["tailwind/**/*.tsx"] }
      ]
    }
  })
});
