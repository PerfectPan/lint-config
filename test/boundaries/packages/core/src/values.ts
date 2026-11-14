export type Outcome<T> = { readonly ok: true; readonly value: T };
export const must = <T>(value: unknown): T => {
  throw new Error(`unimplemented: ${String(value)}`);
};
