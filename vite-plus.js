import fmtConfig from "./oxfmt.json" with { type: "json" };
import lintConfig from "./oxlint.json" with { type: "json" };

// The JSON files are the single source; `$schema` is only meaningful to editors reading the JSON.
const { $schema: _lintSchema, ...lint } = lintConfig;
const { $schema: _fmtSchema, ...fmt } = fmtConfig;

export { fmt, lint };
