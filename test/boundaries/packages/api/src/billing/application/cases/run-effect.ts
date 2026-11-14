import { Effect } from "effect";

export const run = (): Promise<unknown> => Effect.runPromise(Effect.void);
