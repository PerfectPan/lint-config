import { helperValue } from "./helper.js";

export { deadExport } from "./helper.js";

const loadDynamic = async (): Promise<unknown> => await import("./dynamic-loader.js");
const loadComputed = async (name: string): Promise<unknown> => await import(name);

export const main = async (which: string): Promise<unknown> => {
  if (which === "dynamic") {
    return await loadDynamic();
  }
  return await loadComputed(which);
};

void helperValue;
