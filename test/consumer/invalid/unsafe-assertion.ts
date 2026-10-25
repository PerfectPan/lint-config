export function recordId(text: string): string {
  const parsed = JSON.parse(text) as { id: string };
  return parsed.id;
}
