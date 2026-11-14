// Oxlint JS plugin adapter: exposes ESLint's mature no-restricted-syntax, no-restricted-imports and
// no-restricted-globals rules under this package's own `shared-checks` namespace. Generated rules use
// these names so that a boundary override cannot erase a consumer's native restrictions, and a local
// override cannot erase generated ones — the rule ids never collide.
//
// Registering one plugin file twice under two names loses the second alias, so consumers must never
// point another jsPlugins entry at this file; the shared generators register it exactly once.
//
// Loaded by oxlint only when a generated configuration registers the plugin, so the peer import here
// stays off the default path. Missing peer: install oxlint-plugin-eslint.
import eslint from "oxlint-plugin-eslint";

export default {
  rules: {
    "restricted-syntax": eslint.rules["no-restricted-syntax"],
    "restricted-imports": eslint.rules["no-restricted-imports"],
    "restricted-globals": eslint.rules["no-restricted-globals"]
  }
};
