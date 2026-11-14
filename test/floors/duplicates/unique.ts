export function floorUnique(values: readonly number[], multiplier: number): number {
  let total = 0;
  for (const value of values) {
    total += value * multiplier;
  }
  if (total > 1000) {
    return total - 1;
  }
  return total + values.length;
}
