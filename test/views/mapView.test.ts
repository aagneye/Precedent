import { describe, expect, it } from 'vitest';
import { buildMap, groupByMonth, monthLabel, topTags } from '../../src/views/mapView';
import { addDecision } from '../fakes/fixtures';
import { MemoryStore } from '../fakes/memoryStore';

async function decisions() {
  const store = new MemoryStore();
  await addDecision(store, { title: 'A', statement: 'a', decidedAt: '2026-03-02', tags: ['postgresql', 'ledger-service'], ownerAccountId: 'maya' });
  await addDecision(store, { title: 'B', statement: 'b', decidedAt: '2026-10-20', tags: ['kafka'], ownerAccountId: 'raj' });
  await addDecision(store, { title: 'C', statement: 'c', decidedAt: '2026-10-05', tags: ['postgresql'], status: 'under_review', ownerAccountId: 'maya' });
  await addDecision(store, { title: 'D', statement: 'd', decidedAt: '2025-12-01', tags: ['graphql'], status: 'superseded' });
  return store.list();
}

describe('monthLabel', () => {
  it('names months and handles bad input', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(monthLabel('undated')).toBe('Undated');
  });
});

describe('groupByMonth', () => {
  it('groups newest month first, newest decision first', async () => {
    const groups = groupByMonth(await decisions());
    expect(groups.map((g) => [g.label, g.decisions.map((d) => d.title)])).toEqual([
      ['October 2026', ['B', 'C']],
      ['March 2026', ['A']],
      ['December 2025', ['D']],
    ]);
  });
});

describe('topTags', () => {
  it('counts tags by frequency', async () => {
    expect(topTags(await decisions(), 2)).toEqual([
      { tag: 'postgresql', count: 2 },
      { tag: 'graphql', count: 1 },
    ]);
  });
});

describe('buildMap', () => {
  it('counts health over binding decisions only and groups owners by team', async () => {
    const map = buildMap(await decisions(), [], [], new Map([['maya', 'Payments']]));
    expect(map.total).toBe(3);
    expect(map.counts).toEqual({ holding: 2, at_risk: 0, broken: 1 });
    expect(map.teams).toEqual([{ team: 'Payments', decisionKeys: ['DEC-3', 'DEC-1'] }]);
    expect(map.months).toHaveLength(3);
  });
});
