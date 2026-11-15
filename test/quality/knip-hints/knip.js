import { knip } from "@perfectpan/lint-config/knip";

export default {
  ...knip,
  entry: ["src/missing-entry.ts"],
  project: []
};
