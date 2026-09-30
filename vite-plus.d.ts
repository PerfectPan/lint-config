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
    "no-unsafe-optional-chaining": "error";
    "no-unused-vars": "error";
    "vitest/no-conditional-expect": "off";
  };
};

export declare const fmt: {
  printWidth: number;
  sortPackageJson: boolean;
  trailingComma: "none";
};
