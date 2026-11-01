// Structural literal types, as in vite-plus.d.ts. Keep in sync with index.js and rules.json.

type ShadcnOverride = {
  files: string[];
  excludeFiles?: string[];
  plugins?: Array<"react">;
  rules: Record<string, "off" | ["error", Record<string, unknown>]>;
};

/**
 * Overrides that send controls through the shadcn/ui components: `elements` (for example `["button"]`) may not be
 * rendered outside `ui`, Radix primitives other than `@radix-ui/react-slot` may only be imported inside `ui`, and files
 * in `ui` may hold several components. `ui` lists the shadcn/ui component files, such as `src/components/ui/*.tsx`.
 */
export declare function shadcnOverrides(options: { ui: string[]; elements: string[] }): ShadcnOverride[];
