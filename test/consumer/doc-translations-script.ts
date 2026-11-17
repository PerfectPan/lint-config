import process from "node:process";
import { runDocTranslations } from "@perfectpan/lint-config/doc-translations";

process.exitCode = runDocTranslations({
  sources: ["README.md", "docs/**/*.md"],
  translations: ["README.zh-CN.md", "docs/**/*.zh-CN.md"],
  exclude: ["docs/**/0000-template.md"],
  translationOf: (path) => path.replace(/\.md$/, ".zh-CN.md"),
  header: (path) => `> 中文阅读版。以英文原文 ${path} 为准。`,
  stamp: true
});
