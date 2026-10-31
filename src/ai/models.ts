import type { ModelTier } from './llm';

/** Model families to try for each tier, in order of preference. */
const PREFERENCE: Record<ModelTier, RegExp[]> = {
  fast: [/haiku/i, /sonnet/i],
  smart: [/sonnet/i, /opus/i],
};

/** Version numbers in a model id, ignoring 8-digit release dates (e.g. "claude-sonnet-4-5-20250929" → [4, 5]). */
function versionParts(id: string): number[] {
  return (id.match(/\d+/g) ?? []).filter((part) => part.length < 8).map(Number);
}

/** Sorts model ids newest first: by version, then by release date. */
export function compareModelIds(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (right[i] ?? 0) - (left[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return b.localeCompare(a);
}

/** The newest model of the first preferred family that's available, or any model as a last resort. */
export function pickModel(models: string[], tier: ModelTier): string | undefined {
  for (const family of PREFERENCE[tier]) {
    const matches = models.filter((model) => family.test(model)).sort(compareModelIds);
    if (matches.length > 0) return matches[0];
  }
  return [...models].sort(compareModelIds)[0];
}
