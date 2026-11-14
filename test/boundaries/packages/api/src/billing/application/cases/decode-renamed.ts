import { Schema as S } from "effect";

export const decode = (value: unknown) => S.decodeUnknownSync(S.String)(value);
