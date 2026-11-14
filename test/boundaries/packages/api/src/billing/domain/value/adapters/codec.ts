import { Schema } from "effect";

export const isEntry = Schema.is(Schema.Struct({ id: Schema.String }));
export const parseTag = (tag: string): string => tag.trim();
