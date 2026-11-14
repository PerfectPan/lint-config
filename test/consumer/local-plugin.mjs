// The repository's own tiny restriction plugin: coexists with the shared structural guards through a
// different rule namespace, so neither a shared override nor a local one can erase the other.
import eslint from "oxlint-plugin-eslint";

export default { rules: { "restricted-syntax": eslint.rules["no-restricted-syntax"] } };
