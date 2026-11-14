import { knip } from "@perfectpan/lint-config/knip";

export default {
  ...knip,
  entry: ["src/index.ts!"],
  project: ["src/**/*.ts!"],
  includeEntryExports: true
};
