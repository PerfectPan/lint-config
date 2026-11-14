import { Schema } from "effect";

export const isAnything = Schema.is(Schema.Record(Schema.String, Schema.Unknown));
