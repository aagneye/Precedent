import { describe, expect, it } from 'vitest';
import { evaluateWatch, jqlState, type WatchContext } from '../../src/tripwires/watchers';

function context(overrides: Partial<WatchContext> = {}): WatchContext {
  return {
    today: new Date('2026-11-01T09:30:00Z'),
    ownerAccountId: 'acc-maya',
    isUserActive: async () => true,
    countJql: async () => 0,
    goalStatus: async () => 'on_track',
    ...overrides,
  };
}

describe('owner watch', () => {
  it('holds while the owner is active and breaks when they are not', async () => {
    expect(await evaluateWatch({ type: 'owner' }, context())).toMatchObject({ state: 'holding' });
    expect(await evaluateWatch({ type: 'owner' }, context({ isUserActive: async () => false }))).toMatchObject({ state: 'broken' });
  });

  it('is unknown without an owner or when the lookup fails', async () => {
    expect(await evaluateWatch({ type: 'owner' }, context({ ownerAccountId: undefined }))).toMatchObject({ state: 'unknown' });
    expect(await evaluateWatch({ type: 'owner' }, context({ isUserActive: async () => undefined }))).toMatchObject({ state: 'unknown' });
  });
});

describe('date watch', () => {
  it('breaks after the date, warns within the window and holds before it', async () => {
    expect(await evaluateWatch({ type: 'date', expiresOn: '2026-10-31' }, context())).toEqual({ state: 'broken', evidence: 'Expired on 2026-10-31.' });
    expect(await evaluateWatch({ type: 'date', expiresOn: '2026-11-01' }, context())).toEqual({
      state: 'at_risk',
      evidence: 'Expires on 2026-11-01, in 0 days.',
    });
    expect(await evaluateWatch({ type: 'date', expiresOn: '2026-11-10', warnDays: 7 }, context())).toMatchObject({ state: 'holding' });
    expect(await evaluateWatch({ type: 'date', expiresOn: '2026-11-08', warnDays: 7 }, context())).toMatchObject({
      state: 'at_risk',
      evidence: 'Expires on 2026-11-08, in 7 days.',
    });
  });

  it('is unknown for a bad date', async () => {
    expect(await evaluateWatch({ type: 'date', expiresOn: 'next spring' }, context())).toMatchObject({ state: 'unknown' });
  });
});

describe('jqlState', () => {
  it('handles each operator with an at-risk margin', () => {
    expect([0, 1, 2, 3].map((n) => jqlState(n, 'gt', 2))).toEqual(['holding', 'holding', 'at_risk', 'broken']);
    expect([1, 2, 3].map((n) => jqlState(n, 'gte', 3))).toEqual(['holding', 'at_risk', 'broken']);
    expect([4, 5, 6].map((n) => jqlState(n, 'lt', 5))).toEqual(['broken', 'at_risk', 'holding']);
    expect([5, 6, 7].map((n) => jqlState(n, 'lte', 5))).toEqual(['broken', 'at_risk', 'holding']);
    expect([8, 9, 10, 11].map((n) => jqlState(n, 'gt', 10))).toEqual(['holding', 'at_risk', 'at_risk', 'broken']);
  });
});

describe('jql watch', () => {
  it('reports the count as evidence', async () => {
    const watch = { type: 'jql', jql: 'labels = incident', operator: 'gt', threshold: 2 } as const;
    expect(await evaluateWatch(watch, context({ countJql: async () => 3 }))).toEqual({
      state: 'broken',
      evidence: '3 work items match (breaks at more than 2).',
    });
    expect(await evaluateWatch(watch, context({ countJql: async () => undefined }))).toMatchObject({ state: 'unknown' });
  });
});

describe('goal watch', () => {
  it('maps goal status to assumption state', async () => {
    const watch = { type: 'goal', goal: 'Launch in India' } as const;
    expect(await evaluateWatch(watch, context({ goalStatus: async () => 'off_track' }))).toEqual({
      state: 'broken',
      evidence: 'Goal "Launch in India" is off track.',
    });
    expect(await evaluateWatch(watch, context({ goalStatus: async () => 'done' }))).toMatchObject({ state: 'at_risk' });
    expect(await evaluateWatch(watch, context({ goalStatus: async () => undefined }))).toMatchObject({ state: 'unknown' });
  });
});

describe('manual watch', () => {
  it('is never checked', async () => {
    expect(await evaluateWatch({ type: 'manual' }, context())).toBeUndefined();
  });
});
