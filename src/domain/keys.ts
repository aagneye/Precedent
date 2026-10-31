const KEY = /^DEC-(\d+)$/i;

export function formatDecisionKey(seq: number): string {
  return `DEC-${seq}`;
}

export function parseDecisionKey(key: string): number | undefined {
  const match = KEY.exec(key.trim());
  return match ? Number(match[1]) : undefined;
}

/** All decision keys mentioned in a text, upper-cased and de-duplicated. */
export function findDecisionKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const match of text.matchAll(/\bDEC-(\d+)\b/gi)) keys.add(formatDecisionKey(Number(match[1])));
  return [...keys];
}
