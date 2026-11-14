import { createRequire } from "node:module";

export const requireFrom = createRequire(import.meta.url);
export const load = (specifier: string): Promise<unknown> => import(specifier);
