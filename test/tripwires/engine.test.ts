import { describe, expect, it } from 'vitest';
import type { Decision } from '../../src/domain/types';
import { runTripwires, type TripwireDeps } from '../../src/tripwires/engine';
import { suggestSuccessor, type PeoplePort } from '../../src/tripwires/successor';
import { addDecision } from '../fakes/fixtures';
import { MemoryStore } from '../fakes/memoryStore';

interface World {
  store: MemoryStore;
  incidents: number;
  inactive: Set<string>;
  reviews: Array<{ key: string; evidence: string[]; assignee?: string }>;
  deps: TripwireDeps;
}

function world(): World {
  const store = new MemoryStore();
  const w = { store, incidents: 0, inactive: new Set<string>(), reviews: [] as World['reviews'] } as World;
  w.deps = {
    store,
    lookups: {
      isUserActive: async (id) => !w.inactive.has(id),
      countJql: async () => w.incidents,
      goalStatus: async () => 'on_track',
    },
    reviews: {
      async createReview(decision: Decision, evidence: string[], assignee?: string) {
        w.reviews.push({ key: decision.key, evidence, assignee });
        return `PAY-${100 + w.reviews.length}`;
      },
    },
    successor: async () => 'acc-raj',
    now: () => new Date('2026-11-01T00:00:00Z'),
  };
  return w;
}

async function singleRegion(w: World): Promise<Decision> {
  return addDecision(w.store, {
    title: 'Single region until incidents demand more',
    statement: 'We run in one region.',
    ownerAccountId: 'acc-maya',
    assumptions: [
      { text: 'Its owner is still here to steward it', watch: { type: 'owner' } },
      {
        text: 'Two or fewer P1 incidents a month',
        watch: { type: 'jql', jql: 'project = PAY AND labels = incident AND created >= -30d', operator: 'gt', threshold: 2 },
      },
      { text: 'Customers accept regional downtime', watch: { type: 'manual' } },
    ],
  });
}

describe('runTripwires', () => {
  it('records assumption states without opening reviews while everything holds', async () => {
    const w = world();
    await singleRegion(w);
    const result = await runTripwires(w.deps);
    expect(result).toEqual({ decisions: 1, checked: 2, changed: 2, broken: [] });
    expect(w.store.decisions[0].assumptions.map((a) => a.state)).toEqual(['holding', 'holding', 'unknown']);
    expect(w.reviews).toEqual([]);
  });

  it('opens a review for the owner when an assumption breaks, and only once', async () => {
    const w = world();
    await singleRegion(w);
    await runTripwires(w.deps);
    w.incidents = 3;
    const first = await runTripwires(w.deps);
    expect(first.broken).toEqual([
      {
        key: 'DEC-1',
        title: 'Single region until incidents demand more',
        evidence: ['Two or fewer P1 incidents a month: 3 work items match (breaks at more than 2).'],
        reviewIssueKey: 'PAY-101',
        assigneeAccountId: 'acc-maya',
      },
    ]);
    expect(w.store.decisions[0].status).toBe('under_review');
    expect(w.store.events.at(-1)).toMatchObject({ toState: 'broken', reviewIssueKey: 'PAY-101' });

    const second = await runTripwires(w.deps);
    expect(second.broken).toEqual([]);
    expect(w.reviews).toHaveLength(1);
  });

  it("assigns the review to a successor when the owner is gone", async () => {
    const w = world();
    await singleRegion(w);
    await runTripwires(w.deps);
    w.inactive.add('acc-maya');
    const result = await runTripwires(w.deps);
    expect(result.broken[0]).toMatchObject({ assigneeAccountId: 'acc-raj' });
    expect(w.store.events.at(-1)).toMatchObject({ successorAccountId: 'acc-raj' });
  });

  it('only checks the decisions asked for, and skips candidates', async () => {
    const w = world();
    const first = await singleRegion(w);
    await addDecision(w.store, {
      title: 'Draft',
      statement: 'Maybe later.',
      status: 'candidate',
      assumptions: [{ text: 'owner', watch: { type: 'owner' } }],
    });
    await singleRegion(w);
    const result = await runTripwires(w.deps, [first.id]);
    expect(result.decisions).toBe(1);
  });
});

describe('suggestSuccessor', () => {
  const people: PeoplePort = {
    teamsOf: async (id) => (id === 'acc-maya' ? [{ id: 'team-1', name: 'Payments' }] : []),
    membersOf: async () => ['acc-maya', 'acc-gone', 'acc-raj'],
    isUserActive: async (id) => id !== 'acc-gone' && id !== 'acc-maya',
  };

  it('picks the first active teammate other than the owner', async () => {
    expect(await suggestSuccessor('acc-maya', [], people)).toBe('acc-raj');
  });

  it('falls back to an active decider, then to nobody', async () => {
    const noTeams: PeoplePort = { ...people, teamsOf: async () => [] };
    expect(await suggestSuccessor('acc-maya', ['acc-gone', 'acc-lee'], noTeams)).toBe('acc-lee');
    expect(await suggestSuccessor('acc-maya', ['acc-gone'], noTeams)).toBeUndefined();
  });
});
