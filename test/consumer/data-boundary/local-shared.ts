// One file, two namespaces: the local EmptyStatement restriction and the shared structural guard
// both report, and neither erases the other.
;

export const isObject = (value: unknown): boolean => typeof value === "object";
