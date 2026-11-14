// Compile-only consumer of the published declarations: the generated boundary output must stay
// assignable to the consumer's own Vite+/Oxlint configuration types, and the shared Knip policy to
// Knip's real configuration type.
import { fileURLToPath } from "node:url";
import type { OxlintConfig } from "vite-plus/lint";
import type { KnipConfig } from "knip";

import { defineBoundaryLint } from "@perfectpan/lint-config/boundaries";
import { knip } from "@perfectpan/lint-config/knip";
import { defineLint } from "@perfectpan/lint-config/vite-plus";

import { entryExports, manifest } from "../manifest.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const options = { root, manifest, entryExports };
const direct: OxlintConfig = defineBoundaryLint(options);
const composed: OxlintConfig = defineLint({ boundaries: defineBoundaryLint(options) });
const knipConfig = { ...knip, entry: ["src/index.ts"] } satisfies KnipConfig;

export { composed, direct, knipConfig };
