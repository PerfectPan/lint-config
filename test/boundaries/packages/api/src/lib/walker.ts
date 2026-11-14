// The shared traversal tool: typeof-object walks are its job, and the manifest declares the
// exception explicitly.
export const isTraversable = (value: unknown): boolean => typeof value === "object" && value !== null;
