import type { OxlintConfig } from "vite-plus/lint";

import type { BoundaryLint } from "./boundaries";

// Structural literal types instead of importing OxlintConfig/OxfmtConfig: the config objects then
// stay assignable across vite-plus, oxlint and oxfmt versions whose type definitions differ.
// Keep in sync with oxlint.json and oxfmt.json. defineLint uses the consumer's own vite-plus types, which are the
// ones its defineConfig checks against.

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
    "promise/valid-params": "off";
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
  ignorePatterns: string[];
};

/** Tailwind CSS v4 checks; needs eslint-plugin-better-tailwindcss. One entry per stylesheet. */
export interface TailwindOptions {
  /** `entryPoint` is the absolute path of the stylesheet that imports Tailwind; `files` are checked against it. */
  stylesheets: Array<{ entryPoint: string; files: string[]; excludeFiles?: string[] }>;
  /** Report arbitrary values with a literal colour or length. Defaults to true. */
  literalValues?: boolean;
}

/** shadcn/ui checks. `ui` lists the component files; `elements` may only be rendered there. */
export interface ShadcnOptions {
  ui: string[];
  elements: string[];
}

/** Standalone structural-guard checks: loose object walks, isRecord-style predicates and wide
 * Record object predicates are refused in `files`, with `objectWalks` as the declared traversal
 * exception. Needs no package graph; runs through the shared `shared-checks` plugin. */
export interface DataBoundariesOptions {
  files: string[];
  excludeFiles?: string[];
  objectWalks?: string[];
}

/**
 * The shared lint config merged with the repository's: `categories`, `options` and `rules` merge key by key,
 * `plugins` are added, and `overrides` apply after the shared ones and the opt-in checks, with the
 * boundary overrides last. `tailwind` and `shadcn` are off unless given. `dataBoundaries` enables the
 * standalone structural guards; `boundaries` carries a generated boundary configuration whose rule
 * ids and generated settings keys the generator owns — a local setting under an owned key is refused,
 * and giving both features is refused because the manifest owns the guards. Providing `boundaries`
 * requires the boundary peers (`eslint-plugin-boundaries`, `oxlint-plugin-eslint`); the standalone
 * guards only need `oxlint-plugin-eslint`.
 */
export declare function defineLint(
  config?: OxlintConfig & {
    tailwind?: false | TailwindOptions;
    shadcn?: false | ShadcnOptions;
    dataBoundaries?: false | DataBoundariesOptions;
    boundaries?: BoundaryLint;
  }
): OxlintConfig;
