import { tokenize } from './tags';

/** Jaccard similarity of the two texts' word sets, from 0 (disjoint) to 1 (same words). */
export function jaccard(a: string, b: string): number {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (left.size === 0 && right.size === 0) return 1;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

export function isNearDuplicate(a: string, b: string, threshold = 0.75): boolean {
  return jaccard(a, b) >= threshold;
}
