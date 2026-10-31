import { describe, expect, it } from 'vitest';
import { isStrongMatch, rankDecisions } from '../../src/guard/rank';
import { seedAcme } from '../fakes/fixtures';
import { MemoryStore } from '../fakes/memoryStore';

describe('rankDecisions', () => {
  it('ranks shared tags above shared words and ignores non-binding decisions', async () => {
    const store = new MemoryStore();
    await seedAcme(store);
    const ranked = rankDecisions(
      { tags: ['postgresql', 'graphql'], keywords: ['ledger', 'mongodb', 'http'] },
      await store.list(),
    );
    expect(ranked.map((r) => r.decision.key)).toEqual(['DEC-1', 'DEC-3']);
    expect(ranked[0]).toMatchObject({ matchedTags: ['postgresql'], matchedKeywords: ['ledger'] });
    expect(ranked[0].score).toBe(4);
  });

  it('caps the number of results', async () => {
    const store = new MemoryStore();
    await seedAcme(store);
    const ranked = rankDecisions({ tags: ['postgresql', 'multi-region', 'acme-http'], keywords: [] }, await store.list(), 2);
    expect(ranked).toHaveLength(2);
  });
});

describe('isStrongMatch', () => {
  it('needs a tag or two words', async () => {
    const store = new MemoryStore();
    await seedAcme(store);
    const decisions = await store.list();
    const [weak] = rankDecisions({ tags: [], keywords: ['region'] }, decisions);
    const [strong] = rankDecisions({ tags: [], keywords: ['region', 'failover'] }, decisions);
    expect(isStrongMatch(weak)).toBe(false);
    expect(isStrongMatch(strong)).toBe(true);
  });
});
