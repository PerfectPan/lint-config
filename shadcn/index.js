import lintConfig from "../oxlint.json" with { type: "json" };
import config from "./rules.json" with { type: "json" };

// Test files may render plain elements, as in the shared react override.
const testFiles = lintConfig.overrides.find((override) => override.plugins?.includes("react")).excludeFiles;

// These overrides must come after the shared ones: the shared react override turns react/forbid-elements off, and the
// later override wins. An override's no-restricted-imports replaces the repository's own options for the files it
// matches, so a repository with its own import restrictions repeats them in a later override.
function shadcnOverrides({ ui, elements }) {
  const forbid = elements.map((element) => ({ element, message: config.elementMessage.replace("{element}", element) }));
  return [
    {
      files: ["**/*.{jsx,tsx}"],
      excludeFiles: [...testFiles, ...ui],
      plugins: ["react"],
      rules: { "react/forbid-elements": ["error", { forbid }] }
    },
    {
      files: ["**/*"],
      excludeFiles: ui,
      rules: { "no-restricted-imports": ["error", { patterns: [config.restrictedImports] }] }
    },
    // A shadcn/ui file holds a component and its parts.
    { files: ui, plugins: ["react"], rules: { "react/no-multi-comp": "off" } }
  ];
}

export { shadcnOverrides };
