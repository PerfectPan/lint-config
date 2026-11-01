import lintConfig from "../oxlint.json" with { type: "json" };
import config from "./rules.json" with { type: "json" };

// Test files may render plain elements, as in the shared react override.
const testFiles = lintConfig.overrides.find((override) => override.plugins?.includes("react")).excludeFiles;

// An override's no-restricted-imports replaces the top-level setting for the files it matches, so the Radix pattern is
// added to the repository's own restrictions instead of replacing them.
function restrictedImports(local) {
  const [severity, options] = Array.isArray(local) && local[0] !== "off" ? local : ["error", {}];
  return [severity, { ...options, patterns: [...(options.patterns ?? []), config.restrictedImports] }];
}

function shadcnOverrides({ ui, elements }, localRestrictedImports) {
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
      rules: { "no-restricted-imports": restrictedImports(localRestrictedImports) }
    },
    // A shadcn/ui file holds a component and its parts.
    { files: ui, plugins: ["react"], rules: { "react/no-multi-comp": "off" } }
  ];
}

export { shadcnOverrides };
