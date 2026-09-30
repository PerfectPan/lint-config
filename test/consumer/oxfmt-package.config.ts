import { fmt } from "@perfectpan/lint-config/vite-plus";
import { defineConfig } from "oxfmt";

export default defineConfig({ ...fmt, ignorePatterns: ["invalid/**"] });
