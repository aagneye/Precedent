import type { LlmPort, LlmRequest } from '../../src/ai/llm';

/** An LLM that replies from a script, or from a function of the request. Records every request. */
export function scriptedLlm(replies: Array<string | ((request: LlmRequest) => string)>): LlmPort & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  return {
    calls,
    async complete(request) {
      calls.push(request);
      const next = replies.shift();
      const text = typeof next === 'function' ? next(request) : (next ?? '');
      return { text, inputTokens: 100, outputTokens: 50 };
    },
  };
}
