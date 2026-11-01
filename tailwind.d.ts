// Structural literal types, as in vite-plus.d.ts. Keep in sync with tailwind.json.

type TailwindRule = "error" | ["error", { entryPoint: string; restrict?: Array<{ pattern: string; message: string }> }];

export declare const jsPlugins: Array<{ name: "better-tailwindcss"; specifier: "eslint-plugin-better-tailwindcss" }>;

/** The shared better-tailwindcss rules, each checking classes against the stylesheet at `entryPoint` (absolute path). */
export declare function tailwindRules(entryPoint: string): Record<`better-tailwindcss/${string}`, TailwindRule>;
