import { describe, expect, it } from 'vitest';
import { excerptFor, harvestItem, looksLikeDecision, resolveWatch, type HarvestItem } from '../../src/harvest/pipeline';
import { MemoryStore } from '../fakes/memoryStore';
import { scriptedLlm } from '../fakes/scriptedLlm';

const comment: HarvestItem = {
  kind: 'jira_comment',
  ref: 'PAY-7/10001',
  url: 'https://acme.atlassian.net/browse/PAY-7?focusedCommentId=10001',
  title: 'Comment on PAY-7',
  text: 'After the platform sync we agreed: all outbound HTTP calls go through acme-http, which handles retries and tracing. We will not add new HTTP client libraries.',
  authorAccountId: 'acc-maya',
  createdAt: '2026-10-20T10:00:00.000Z',
  projectKey: 'PAY',
  linkedIssueKey: 'PAY-7',
};

const extraction = JSON.stringify({
  decisions: [
    {
      title: 'Outbound HTTP goes through acme-http',
      statement: 'We send all outbound HTTP calls through acme-http and add no new HTTP client libraries.',
      rationale: 'acme-http handles retries and tracing consistently.',
      tags: ['acme-http', 'HTTP client', 'retries'],
      assumptions: [
        {
          text: 'Fewer than 3 HTTP incidents a month',
          watch: { type: 'jql', jql: 'project = KEY AND labels = http-incident AND created >= -30d', operator: 'gt', threshold: 2 },
        },
      ],
      confidence: 0.9,
    },
    { title: 'Maybe use gRPC', statement: 'We might try gRPC someday.', confidence: 0.2 },
  ],
});

describe('looksLikeDecision', () => {
  it('needs decision language and some length', () => {
    expect(looksLikeDecision(comment.text)).toBe(true);
    expect(looksLikeDecision('Agreed.')).toBe(false);
    expect(looksLikeDecision('Here is the status update for this sprint and the burndown chart for review.')).toBe(false);
  });
});

describe('resolveWatch', () => {
  it('fills the placeholder project key', () => {
    expect(resolveWatch({ type: 'jql', jql: 'project = KEY AND labels = incident', operator: 'gt', threshold: 2 }, 'PAY')).toEqual({
      type: 'jql',
      jql: 'project = PAY AND labels = incident',
      operator: 'gt',
      threshold: 2,
    });
  });

  it('makes the watch manual when no project key is known', () => {
    expect(resolveWatch({ type: 'jql', jql: 'project = PROJECT', operator: 'gt', threshold: 1 })).toEqual({ type: 'manual' });
  });

  it('leaves other watches alone', () => {
    expect(resolveWatch({ type: 'date', expiresOn: '2027-03-31' }, 'PAY')).toEqual({ type: 'date', expiresOn: '2027-03-31' });
  });
});

describe('excerptFor', () => {
  it('picks the sentence closest to the statement', () => {
    expect(excerptFor(comment.text, 'We will not add new HTTP client libraries')).toBe('We will not add new HTTP client libraries.');
  });
});

describe('harvestItem', () => {
  it('files confident decisions as candidates with sources, tags and watches', async () => {
    const store = new MemoryStore();
    const llm = scriptedLlm([extraction]);
    const result = await harvestItem(comment, { store, llm, today: () => '2026-11-01' });

    expect(result.created).toEqual(['DEC-1']);
    const [decision] = store.decisions;
    expect(decision.status).toBe('candidate');
    expect(decision.origin).toBe('harvest');
    expect(decision.ownerAccountId).toBe('acc-maya');
    expect(decision.decidedAt).toBe('2026-10-20');
    expect(decision.tags).toEqual(['acme-http', 'http-client', 'retries']);
    expect(decision.sources[0]).toMatchObject({ kind: 'jira_comment', ref: 'PAY-7/10001' });
    expect(decision.assumptions.map((a) => a.watch.type)).toEqual(['owner', 'jql']);
    expect(decision.assumptions[1].watch).toMatchObject({ jql: 'project = PAY AND labels = http-incident AND created >= -30d' });
    expect(llm.calls[0].prompt).toContain('Jira project key for JQL: PAY');
  });

  it('does not harvest the same source twice', async () => {
    const store = new MemoryStore();
    await harvestItem(comment, { store, llm: scriptedLlm([extraction]), today: () => '2026-11-01' });
    const again = await harvestItem(comment, { store, llm: scriptedLlm([extraction]), today: () => '2026-11-01' });
    expect(again).toEqual({ created: [], skipped: 'Already harvested.' });
  });

  it('skips near-duplicates of decisions it already knows', async () => {
    const store = new MemoryStore();
    await harvestItem(comment, { store, llm: scriptedLlm([extraction]), today: () => '2026-11-01' });
    const elsewhere = { ...comment, ref: 'PAY-9/10002' };
    const result = await harvestItem(elsewhere, { store, llm: scriptedLlm([extraction]), today: () => '2026-11-01' });
    expect(result.created).toEqual([]);
    expect(store.decisions).toHaveLength(1);
  });

  it('spends no AI on text without decision language', async () => {
    const llm = scriptedLlm([]);
    const result = await harvestItem({ ...comment, text: 'Looks good to me, thanks for the quick turnaround on this one!' }, {
      store: new MemoryStore(),
      llm,
      today: () => '2026-11-01',
    });
    expect(result.skipped).toBe('No decision language found.');
    expect(llm.calls).toHaveLength(0);
  });
});
