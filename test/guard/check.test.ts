import { describe, expect, it } from 'vitest';
import type { LlmPort } from '../../src/ai/llm';
import { checkWork } from '../../src/guard/check';
import { seedAcme } from '../fakes/fixtures';
import { MemoryStore } from '../fakes/memoryStore';
import { scriptedLlm } from '../fakes/scriptedLlm';

const MONGO_ISSUE = 'Migrate the ledger service from Postgres to MongoDB to speed up writes.';

async function acme(): Promise<MemoryStore> {
  const store = new MemoryStore();
  await seedAcme(store);
  return store;
}

describe('checkWork with AI', () => {
  it('returns conflicts first and drops irrelevant or unknown decisions', async () => {
    const store = await acme();
    const llm = scriptedLlm([
      (request) => {
        expect(request.tier).toBe('smart');
        expect(request.prompt).toContain('DEC-1');
        return JSON.stringify({
          findings: [
            { key: 'DEC-3', verdict: 'relevant', reason: 'Calls to the new store must use acme-http.' },
            { key: 'DEC-1', verdict: 'conflict', reason: 'DEC-1 keeps the ledger on PostgreSQL.', suggestion: 'Tune Postgres instead.' },
            { key: 'DEC-99', verdict: 'conflict', reason: 'Made up.' },
            { key: 'DEC-2', verdict: 'irrelevant', reason: 'Unrelated.' },
          ],
        });
      },
    ]);
    const result = await checkWork(`${MONGO_ISSUE} Use the http client for calls.`, { store, llm }, { channel: 'panel', actor: 'acc-1' });

    expect(result.aiChecked).toBe(true);
    expect(result.conflicts).toBe(1);
    expect(result.findings.map((f) => [f.key, f.verdict])).toEqual([
      ['DEC-1', 'conflict'],
      ['DEC-3', 'relevant'],
    ]);
    expect(result.findings[0]).toMatchObject({ suggestion: 'Tune Postgres instead.', health: 'holding' });
    expect(store.checks).toHaveLength(1);
    expect(store.checks[0]).toMatchObject({ channel: 'panel', actor: 'acc-1', conflicts: 1, decisionKeys: ['DEC-1', 'DEC-3'] });
  });

  it('asks the fast model for tags when nothing matches directly', async () => {
    const store = await acme();
    const llm = scriptedLlm([
      JSON.stringify({ tags: ['postgresql'] }),
      JSON.stringify({ findings: [{ key: 'DEC-1', verdict: 'conflict', reason: 'Replaces the ledger database.' }] }),
    ]);
    const result = await checkWork('Swap our primary datastore for a document DB', { store, llm }, { channel: 'mcp' });
    expect(llm.calls.map((c) => c.tier)).toEqual(['fast', 'smart']);
    expect(result.findings.map((f) => f.key)).toEqual(['DEC-1']);
  });

  it('falls back to tag matching when the AI fails', async () => {
    const store = await acme();
    const failing: LlmPort = {
      async complete() {
        throw new Error('Monthly AI budget reached');
      },
    };
    const result = await checkWork(MONGO_ISSUE, { store, llm: failing }, { channel: 'rovo' });
    expect(result.aiChecked).toBe(false);
    expect(result.note).toContain('Monthly AI budget reached');
    expect(result.findings.map((f) => [f.key, f.verdict])).toEqual([['DEC-1', 'relevant']]);
  });
});

describe('checkWork without AI', () => {
  it('reports strong tag matches as relevant, never as conflicts', async () => {
    const store = await acme();
    const result = await checkWork(MONGO_ISSUE, { store }, { channel: 'panel' });
    expect(result.aiChecked).toBe(false);
    expect(result.conflicts).toBe(0);
    expect(result.findings[0]).toMatchObject({ key: 'DEC-1', verdict: 'relevant' });
    expect(result.findings[0].reason).toContain('postgresql');
  });

  it('finds nothing for unrelated work', async () => {
    const result = await checkWork('Update the onboarding email copy', { store: await acme() }, { channel: 'panel' });
    expect(result.findings).toEqual([]);
  });
});
