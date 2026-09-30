import { lint } from "@perfectpan/lint-config/vite-plus";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [lint],
  overrides: [{ files: ["invalid/warning.ts"], rules: { "no-console": "warn" } }]
});
