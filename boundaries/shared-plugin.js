// Private shared descriptor module: hosts the shared-checks plugin registration and the rule and
// settings keys the generated boundary features own. Both `defineLint` and the boundary generator
// import it, so the standalone guard never needs to load the whole generator.
import { fileURLToPath } from "node:url";

/** The oxlint JS plugin adapter that hosts the generated rules under the shared `shared-checks`
 * namespace, resolved as a file inside this package's installed location. */
export const sharedChecksPlugin = {
  name: "shared-checks",
  specifier: fileURLToPath(new URL("../shared-checks.mjs", import.meta.url))
};

/** Rule ids the full boundary generator emits and owns. */
export const boundaryOwnedRules = [
  "boundaries/dependencies",
  "shared-checks/restricted-syntax",
  "shared-checks/restricted-imports",
  "shared-checks/restricted-globals"
];

/** Settings keys the full boundary generator emits and owns — exactly the keys it writes. */
export const boundaryOwnedSettingsKeys = [
  "boundaries/root-path",
  "boundaries/elements",
  "boundaries/files",
  "boundaries/flag-as-external",
  "boundaries/dependency-nodes",
  "boundaries/additional-dependency-nodes",
  "boundaries/legacy-templates",
  "import/resolver"
];

/** Rule ids the standalone structural guards emit and own. */
export const dataOwnedRules = ["shared-checks/restricted-syntax"];
