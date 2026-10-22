// A schema module shaped like zod/mini's functional API: `catch(schema, fallback)` returns a schema that falls back
// instead of failing. It shares only the method name with Promise.prototype.catch.
export interface Schema<T> {
  parse(value: unknown): T;
}

function withFallback<T>(schema: Schema<T>, fallback: T): Schema<T> {
  return {
    parse(value) {
      try {
        return schema.parse(value);
      } catch {
        return fallback;
      }
    }
  };
}

export { withFallback as catch };
