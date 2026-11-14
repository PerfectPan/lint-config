export function numericTotal(values: readonly number[]): number {
  let sum = 0;
  let seen = 0;
  for (const value of values) {
    sum += value;
    seen += 1;
  }
  return seen > 0 ? sum / seen : sum;
}
