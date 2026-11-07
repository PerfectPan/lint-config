// Minimal JSX types so the .tsx fixtures type-check without React or Solid installed.
declare namespace JSX {
  type Element = unknown;
  interface IntrinsicElements {
    [name: string]: Record<string, unknown>;
  }
}
