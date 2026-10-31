import { describe, expect, it } from 'vitest';
import { ACME_ISSUES, ACME_PAGES, acmeDecisions, incidentIssues } from '../../src/demo/acme';
import { checkWork } from '../../src/guard/check';
import { evaluateWatch } from '../../src/tripwires/watchers';
import { MemoryStore } from '../fakes/memoryStore';

const today = new Date('2026-12-10T08:00:00Z');

async function seeded(): Promise<MemoryStore> {
  const store = new MemoryStore();
  for (const d of acmeDecisions('ACME', today)) {
    await store.create({ ...d, origin: 'demo', sources: [], ownerAccountId: 'acc-me' });
  }
  return store;
}

describe('Acme Pay fixtures', () => {
  it('has 12 ratified decisions and 3 candidates, each from a known page', () => {
    const decisions = acmeDecisions('ACME', today);
    expect(decisions.filter((d) => d.status === 'ratified')).toHaveLength(12);
    expect(decisions.filter((d) => d.status === 'candidate')).toHaveLength(3);
    const slugs = new Set(ACME_PAGES.map((p) => p.slug));
    expect(decisions.every((d) => slugs.has(d.pageSlug))).toBe(true);
    expect(decisions.every((d) => d.assumptions[0].watch.type === 'owner')).toBe(true);
  });

  it('gives DEC-1 to DEC-3 their demo roles on a fresh install', async () => {
    const store = await seeded();
    expect((await store.getByKey('DEC-1'))?.title).toBe('Ledger stays on PostgreSQL');
    expect((await store.getByKey('DEC-2'))?.title).toBe('Single region until incidents demand more');
    expect((await store.getByKey('DEC-3'))?.title).toBe('Outbound HTTP goes through acme-http');
  });

  it("watches the demo project's incidents and a renewal that is about to expire", async () => {
    const decisions = acmeDecisions('ACME', today);
    const region = decisions[1].assumptions[1].watch;
    expect(region).toEqual({ type: 'jql', jql: 'project = ACME AND labels = incident AND created >= -30d', operator: 'gt', threshold: 2 });
    const renewal = decisions[4].assumptions[1].watch;
    const state = await evaluateWatch(renewal, {
      today,
      isUserActive: async () => true,
      countJql: async () => 0,
      goalStatus: async () => undefined,
    });
    expect(state?.state).toBe('at_risk');
  });

  it('files enough incidents to break the single-region tripwire', () => {
    const incidents = incidentIssues(3, today);
    expect(incidents).toHaveLength(3);
    expect(incidents.every((i) => i.labels.includes('incident'))).toBe(true);
  });
});

describe('demo issues against demo decisions (tag matching, no AI)', () => {
  it.each([
    [0, 'DEC-1'],
    [1, 'DEC-3'],
    [2, 'DEC-6'],
    [3, 'DEC-4'],
    [4, 'DEC-2'],
    [5, 'DEC-10'],
  ])('issue %i surfaces %s', async (index, key) => {
    const store = await seeded();
    const issue = ACME_ISSUES[index];
    const result = await checkWork(`${issue.summary}\n${issue.description}`, { store }, { channel: 'panel' });
    expect(result.findings.map((f) => f.key)).toContain(key);
  });
});
