// Compile-only consumer of the published Knip declaration: the shared Knip policy must stay
// assignable to Knip's real configuration type.
import { knip } from "@perfectpan/lint-config/knip";
import type { KnipConfig } from "knip";

export const knipConfig = {
  ...knip,
  entry: ["src/index.ts"],
  project: ["src/**/*.ts"]
} satisfies KnipConfig;
