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

// Declared after their first use on purpose: function declarations hoist, so the shared no-use-before-define
// setting (functions: false) keeps a helper below its entry function allowed, and a type referenced before
// its declaration stays allowed through the default ignoreTypeReferences.
export function runFallback(): string {
  return fallback();
}

export function spinUntil(until: () => boolean): void {
  while (true) {
    if (until()) {
      return;
    }
  }
}

function fallback(): string {
  return describe([]);
}

export function makeNamed(label: string): Named {
  return { label };
}

interface Named {
  label: string;
}
