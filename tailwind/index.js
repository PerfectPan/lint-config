import config from "./rules.json" with { type: "json" };

const { jsPlugins, rules } = config;
const literalValueRule = "better-tailwindcss/no-restricted-classes";

// The plugin compiles the stylesheet at entryPoint to learn the theme. It looks a relative path up from the working
// directory and, when nothing matches, only warns and falls back to Tailwind's default theme, so every rule carries the
// path the caller passes in.
function stylesheetRules(entryPoint, literalValues) {
  return Object.fromEntries(
    Object.entries(rules)
      .filter(([name]) => literalValues || name !== literalValueRule)
      .map(([name, [severity, options]]) => [name, [severity, { ...options, entryPoint }]])
  );
}

function tailwindOverrides({ stylesheets, literalValues = true }) {
  return stylesheets.map(({ entryPoint, files, excludeFiles }) => ({
    files,
    ...(excludeFiles ? { excludeFiles } : {}),
    rules: stylesheetRules(entryPoint, literalValues)
  }));
}

export { jsPlugins as tailwindPlugins, tailwindOverrides };
