// Structural literal types instead of importing OxlintConfig/OxfmtConfig: the config objects then
// stay assignable across vite-plus, oxlint and oxfmt versions whose type definitions differ.
// Keep in sync with oxlint.json and oxfmt.json.

export declare const lint: {
  plugins: Array<"import" | "node" | "oxc" | "promise" | "typescript" | "unicorn" | "vitest">;
  categories: { correctness: "error" };
  options: {
    denyWarnings: boolean;
    reportUnusedDisableDirectives: "error";
    typeAware: boolean;
    typeCheck: boolean;
  };
  rules: {
    curly: ["error", "all"];
    "max-lines": ["error", { max: number }];
    "no-unsafe-optional-chaining": "error";
    "no-unnecessary-condition": ["error", { allowConstantLoopConditions: "always" }];
    "no-unused-vars": "error";
    "no-use-before-define": ["error", { functions: boolean }];
    "unicorn/filename-case": ["error", { case: "kebabCase"; ignore: string[] }];
    "vitest/no-conditional-expect": "off";
  };
  overrides: Array<{
    files: string[];
    excludeFiles?: string[];
    plugins?: Array<"react">;
    rules: Record<string, "error" | "off">;
  }>;
};

export declare const fmt: {
  printWidth: number;
  sortPackageJson: boolean;
  trailingComma: "none";
};
