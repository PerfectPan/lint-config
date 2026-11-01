import config from "./tailwind.json" with { type: "json" };

const { jsPlugins, rules } = config;

// The plugin compiles the stylesheet at entryPoint to learn the theme. It looks a relative path up from the working
// directory and, when nothing matches, only warns and falls back to Tailwind's default theme, so every rule carries the
// path the caller passes in.
function tailwindRules(entryPoint) {
  return Object.fromEntries(
    Object.entries(rules).map(([name, [severity, options]]) => [name, [severity, { ...options, entryPoint }]])
  );
}

export { jsPlugins, tailwindRules };
