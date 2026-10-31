import type { z } from 'zod';
import { parseJson, type ParseResult } from './json';

/** `fast` classifies and tags; `smart` extracts decisions and judges conflicts. */
export type ModelTier = 'fast' | 'smart';

export interface LlmRequest {
  tier: ModelTier;
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmPort {
  complete(request: LlmRequest): Promise<LlmResponse>;
}

export interface UsageSnapshot {
  month: string;
  tokens: number;
  calls: number;
  budget: number;
}

export interface UsageMeter {
  snapshot(): Promise<UsageSnapshot>;
  record(tokens: number): Promise<void>;
}

export class BudgetExceededError extends Error {
  constructor(readonly usage: UsageSnapshot) {
    super(`Monthly AI budget reached (${usage.tokens} of ${usage.budget} tokens)`);
    this.name = 'BudgetExceededError';
  }
}

/** Refuses calls once the month's token budget is spent, and meters every call it lets through. */
export class BudgetedLlm implements LlmPort {
  constructor(
    private readonly inner: LlmPort,
    private readonly meter: UsageMeter,
  ) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const usage = await this.meter.snapshot();
    if (usage.budget > 0 && usage.tokens >= usage.budget) throw new BudgetExceededError(usage);
    const response = await this.inner.complete(request);
    await this.meter.record(response.inputTokens + response.outputTokens);
    return response;
  }
}

const RETRY_NUDGE = '\n\nYour previous reply was not valid JSON for the requested shape. Reply with only the JSON.';

/** Asks for JSON and validates it, retrying once with a nudge if the first reply doesn't parse. */
export async function completeJson<T>(llm: LlmPort, request: LlmRequest, schema: z.ZodType<T>): Promise<ParseResult<T>> {
  const first = await llm.complete(request);
  const parsed = parseJson(first.text, schema);
  if (parsed.ok) return parsed;
  const second = await llm.complete({ ...request, prompt: request.prompt + RETRY_NUDGE });
  return parseJson(second.text, schema);
}
