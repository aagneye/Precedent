import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  BudgetedLlm,
  BudgetExceededError,
  completeJson,
  type LlmPort,
  type LlmRequest,
  type UsageMeter,
} from '../../src/ai/llm';
import { compareModelIds, pickModel } from '../../src/ai/models';
import { ExtractedDecisionSchema } from '../../src/ai/prompts';

function scripted(replies: string[]): LlmPort & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  return {
    calls,
    async complete(request) {
      calls.push(request);
      return { text: replies.shift() ?? '', inputTokens: 10, outputTokens: 5 };
    },
  };
}

function meter(tokens: number, budget: number): UsageMeter & { recorded: number[] } {
  const recorded: number[] = [];
  return {
    recorded,
    async snapshot() {
      return { month: '2026-11', tokens, calls: 0, budget };
    },
    async record(n) {
      recorded.push(n);
    },
  };
}

const request: LlmRequest = { tier: 'fast', system: 's', prompt: 'p' };

describe('BudgetedLlm', () => {
  it('passes calls through and records their tokens', async () => {
    const usage = meter(0, 1000);
    const llm = new BudgetedLlm(scripted(['ok']), usage);
    expect((await llm.complete(request)).text).toBe('ok');
    expect(usage.recorded).toEqual([15]);
  });

  it('refuses calls once the budget is spent', async () => {
    const llm = new BudgetedLlm(scripted(['ok']), meter(1000, 1000));
    await expect(llm.complete(request)).rejects.toBeInstanceOf(BudgetExceededError);
  });

  it('treats a zero budget as unlimited', async () => {
    const llm = new BudgetedLlm(scripted(['ok']), meter(5_000_000, 0));
    expect((await llm.complete(request)).text).toBe('ok');
  });
});

describe('completeJson', () => {
  const schema = z.object({ tags: z.array(z.string()) });

  it('retries once with a nudge when the first reply is not valid JSON', async () => {
    const llm = scripted(['not json', '{"tags":["kafka"]}']);
    expect(await completeJson(llm, request, schema)).toEqual({ ok: true, value: { tags: ['kafka'] } });
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1].prompt).toContain('not valid JSON');
  });

  it('gives up after the retry', async () => {
    const result = await completeJson(scripted(['nope', 'still nope']), request, schema);
    expect(result.ok).toBe(false);
  });
});

describe('model selection', () => {
  const models = ['claude-sonnet-4-20250514', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001', 'claude-opus-4-1-20250805'];

  it('sorts model ids newest first', () => {
    expect(['claude-sonnet-4-20250514', 'claude-sonnet-5-20260601', 'claude-sonnet-4-5-20250929'].sort(compareModelIds)).toEqual([
      'claude-sonnet-5-20260601',
      'claude-sonnet-4-5-20250929',
      'claude-sonnet-4-20250514',
    ]);
  });

  it('prefers haiku for fast work and the newest sonnet for smart work', () => {
    expect(pickModel(models, 'fast')).toBe('claude-haiku-4-5-20251001');
    expect(pickModel(models, 'smart')).toBe('claude-sonnet-4-5-20250929');
  });

  it('falls back to another family, then to any model', () => {
    expect(pickModel(['claude-sonnet-4-5-20250929'], 'fast')).toBe('claude-sonnet-4-5-20250929');
    expect(pickModel(['some-other-model-2'], 'smart')).toBe('some-other-model-2');
    expect(pickModel([], 'smart')).toBeUndefined();
  });
});

describe('ExtractedDecisionSchema', () => {
  it('turns a malformed watch into a manual one instead of rejecting the decision', () => {
    const parsed = ExtractedDecisionSchema.parse({
      title: 'Ledger stays on PostgreSQL',
      statement: 'We keep the ledger on PostgreSQL.',
      assumptions: [{ text: 'Write volume stays under 5k TPS', watch: { type: 'jql', jql: 'x' } }],
    });
    expect(parsed.assumptions[0].watch).toEqual({ type: 'manual' });
    expect(parsed.rationale).toBe('');
    expect(parsed.tags).toEqual([]);
  });
});
