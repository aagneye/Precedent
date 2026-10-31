import { describe, expect, it } from 'vitest';
import type { Finding, GuardResult } from '../../src/guard/check';
import {
  formatCheck,
  formatIssueContext,
  formatRecorded,
  formatSearch,
  formatUnderReview,
} from '../../src/services/agentText';
import { toDecisionView } from '../../src/views/decisionView';
import { addDecision } from '../fakes/fixtures';
import { MemoryStore } from '../fakes/memoryStore';

function finding(overrides: Partial<Finding>): Finding {
  return {
    key: 'DEC-3',
    title: 'Outbound HTTP goes through acme-http',
    statement: 'We send all outbound HTTP calls through acme-http.',
    rationale: 'Consistent retries and tracing.',
    verdict: 'conflict',
    reason: 'The plan adds axios.',
    status: 'ratified',
    health: 'holding',
    sources: [],
    ...overrides,
  };
}

function result(findings: Finding[], extra: Partial<GuardResult> = {}): GuardResult {
  return { findings, conflicts: findings.filter((f) => f.verdict === 'conflict').length, aiChecked: true, ...extra };
}

describe('formatCheck', () => {
  it('tells the agent to stop on conflicts and explains each one', () => {
    const text = formatCheck(
      result([
        finding({ suggestion: 'Use acme-http.get with its retry option.' }),
        finding({ key: 'DEC-9', title: 'Backoff policy', verdict: 'relevant', reason: 'Retries must back off.', status: 'under_review' }),
      ]),
    );
    expect(text.startsWith('Do not go ahead with the conflicting parts.')).toBe(true);
    expect(text).toContain('CONFLICT DEC-3 — Outbound HTTP goes through acme-http: The plan adds axios. Suggested approach: Use acme-http.get');
    expect(text).toContain('APPLIES DEC-9 — Backoff policy: Retries must back off. (This decision is under review');
    expect(text).toContain('Why: Consistent retries and tracing.');
  });

  it('says to proceed when nothing applies, with any note', () => {
    expect(formatCheck(result([]))).toBe('No team decisions apply to this plan. Proceed.');
    expect(formatCheck(result([], { aiChecked: false, note: 'AI checking is off.' }))).toBe(
      'No team decisions apply to this plan. Proceed.\nNote: AI checking is off.',
    );
  });

  it('says to follow relevant decisions when there are no conflicts', () => {
    expect(formatCheck(result([finding({ verdict: 'relevant' })]))).toMatch(/^No conflicts\. Follow these decisions/);
  });
});

describe('formatSearch and formatRecorded', () => {
  it('admits when nothing matches instead of guessing', () => {
    expect(formatSearch('kafka', [])).toContain("The team may not have decided this yet");
  });

  it('describes matching decisions', async () => {
    const store = new MemoryStore();
    const view = toDecisionView(await addDecision(store, { title: 'Use Kafka for events', statement: 'We publish domain events to Kafka.' }));
    expect(formatSearch('kafka', [view])).toContain('1 decision match "kafka":\n\nDEC-1 — Use Kafka for events [ratified, holding]');
    expect(formatRecorded({ ...view, status: 'candidate' })).toBe(
      'Recorded DEC-1 "Use Kafka for events" as a candidate decision. A teammate ratifies it in Precedent\'s inbox before it becomes binding.',
    );
  });
});

describe('formatUnderReview', () => {
  it('lists what changed and the review work item', async () => {
    const store = new MemoryStore();
    const view = toDecisionView(
      await addDecision(store, { title: 'Single region', statement: 'We run in one region.', status: 'under_review' }),
    );
    expect(formatUnderReview([])).toBe('No decisions are under review. Every ratified decision is holding.');
    expect(formatUnderReview([{ decision: view, latestEvidence: '3 incidents in 30 days.', reviewIssueKey: 'PAY-20' }])).toBe(
      'DEC-1 — Single region\n  Decision: We run in one region.\n  What changed: 3 incidents in 30 days.\n  Review: PAY-20',
    );
  });
});

describe('formatIssueContext', () => {
  it('combines the work item with the decisions that apply', () => {
    const text = formatIssueContext(
      { id: '1', key: 'PAY-7', summary: 'Add retries to payout webhooks', description: 'Use axios-retry.', projectKey: 'PAY', labels: [], components: [], status: 'To Do' },
      result([finding({})]),
    );
    expect(text).toContain('PAY-7: Add retries to payout webhooks [To Do]\nUse axios-retry.');
    expect(text).toContain('Team decisions that apply:\nCONFLICT DEC-3');
  });
});
