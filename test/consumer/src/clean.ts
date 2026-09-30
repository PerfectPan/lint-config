export interface Options {
  label?: string;
}

// Formatting-sensitive on purpose: the oxfmt defaults (printWidth 100, trailingComma "all") would rewrite this file.
export const defaults: Required<Options> = {
  label: "first"
};

export function describe(items: readonly string[], options: Options = {}, fallback = "empty"): string {
  const first = items[0];
  if (first === undefined) {
    return options.label ?? fallback;
  }
  return `${options.label ?? defaults.label}: ${first}`;
}
