import { createRequire } from "node:module";

export const requireFrom = createRequire(import.meta.url);
