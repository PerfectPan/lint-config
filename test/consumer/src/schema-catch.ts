// The two-argument call that promise/valid-params used to report as Promise.catch().
import * as schema from "./schema.js";

const text: schema.Schema<string> = { parse: (value) => String(value) };

export const label = schema.catch(text, "untitled");
