export function alphabeticalSort(values: readonly string[]): readonly string[] {
  const copy = [...values];
  copy.sort((left, right) => left.localeCompare(right));
  const unique = copy.filter((value, index) => index === 0 || copy[index - 1] !== value);
  return unique.map((value) => value.trim()).filter((value) => value.length > 0);
}
