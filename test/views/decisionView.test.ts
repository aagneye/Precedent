import { describe, expect, it } from 'vitest';
import { describeDecision, toDecisionView, toEventView, watchSummary } from '../../src/views/decisionView';
import { addDecision } from '../fakes/fixtures';
import { MemoryStore } from '../fakes/memoryStore';

describe('watchSummary', () => {
  it('describes each watch in plain words', () => {
    expect(watchSummary({ type: 'owner' })).toBe('Watched: the owner stays active');
    expect(watchSummary({ type: 'date', expiresOn: '2027-03-31' })).toBe('Watched: expires on 2027-03-31');
    expect(watchSummary({ type: 'jql', jql: 'labels = incident', operator: 'gt', threshold: 2 })).toBe(
      'Watched: breaks when more than 2 work items match `labels = incident`',
    );
    expect(watchSummary({ type: 'goal', goal: 'Launch in India' })).toBe('Watched: goal "Launch in India" stays on track');
    expect(watchSummary({ type: 'manual' })).toBe('Not checked automatically');
  });
});

describe('toDecisionView', () => {
  it('adds health and watch summaries', async () => {
    const store = new MemoryStore();
    const decision = await addDecision(store, {
      title: 'LaunchDarkly for feature flags',
      statement: 'We use LaunchDarkly for feature flags.',
      tags: ['launchdarkly'],
      assumptions: [{ text: 'Contract runs until March 2027', watch: { type: 'date', expiresOn: '2027-03-31' } }],
    });
    const view = toDecisionView(decision);
    expect(view).toMatchObject({ key: 'DEC-1', status: 'ratified', health: 'holding', tags: ['launchdarkly'] });
    expect(view.assumptions[0]).toMatchObject({ watchType: 'date', watchSummary: 'Watched: expires on 2027-03-31', state: 'unknown' });
  });
});

describe('describeDecision', () => {
  it('produces a compact text block for agents', async () => {
    const store = new MemoryStore();
    const decision = await addDecision(store, {
      title: 'Ledger stays on PostgreSQL',
      statement: 'We keep the ledger service on PostgreSQL.',
      rationale: 'Money movement needs ACID transactions.',
      decidedAt: '2026-03-02',
      sources: [{ kind: 'confluence_page', ref: '1', url: 'https://acme.atlassian.net/wiki/x', title: 'ADR-001' }],
    });
    expect(describeDecision(toDecisionView(decision))).toBe(
      [
        'DEC-1 — Ledger stays on PostgreSQL [ratified, holding]',
        'Statement: We keep the ledger service on PostgreSQL.',
        'Why: Money movement needs ACID transactions.',
        'Decided: 2026-03-02',
        'Source: ADR-001 https://acme.atlassian.net/wiki/x',
      ].join('\n'),
    );
  });
});

describe('toEventView', () => {
  it('attaches the decision key and title', () => {
    expect(
      toEventView(
        { id: 1, decisionId: 2, toState: 'broken', evidence: 'Expired.', reviewIssueKey: 'PAY-9', createdAt: '2026-11-01T00:00:00.000Z' },
        { key: 'DEC-2', title: 'Single region' },
      ),
    ).toEqual({
      decisionKey: 'DEC-2',
      decisionTitle: 'Single region',
      toState: 'broken',
      evidence: 'Expired.',
      reviewIssueKey: 'PAY-9',
      successorAccountId: undefined,
      createdAt: '2026-11-01T00:00:00.000Z',
    });
  });
});
