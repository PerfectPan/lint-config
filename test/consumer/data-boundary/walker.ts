// The declared traversal tool: the manifest's objectWalks exception keeps this walk legal.
export const isTraversable = (value: unknown): boolean => typeof value === "object" && value !== null;
