export const uniqueConstant = "quality-fixture-clean";
export const uniqueTotal = uniqueConstant.length * 3;
export function uniqueTransform(input: readonly string[]): readonly string[] {
  return input.filter((entry) => entry.includes(uniqueConstant)).map((entry) => entry.toUpperCase());
}
