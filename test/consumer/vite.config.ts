import { fmt, lint } from "@perfectpan/lint-config/vite-plus";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ...fmt,
    ignorePatterns: ["invalid/**"]
  },
  lint: {
    ...lint,
    overrides: [
      ...lint.overrides,
      {
        files: ["invalid/warning.ts"],
        rules: { "no-console": "warn" }
      }
    ]
  }
});
