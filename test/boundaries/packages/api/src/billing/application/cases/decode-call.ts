import { Schema } from "effect";

export const decode = (value: unknown) => Schema.decodeUnknownSync(Schema.Struct({}))(value);
