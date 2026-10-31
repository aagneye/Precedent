import { ForgeLlm } from '../ai/forgeLlm';
import { BudgetedLlm, type LlmPort } from '../ai/llm';
import { KvsUsageMeter } from '../ai/usage';
import { getSettings, type Settings } from '../config/settings';
import { SqlDecisionStore } from '../db/sqlStore';
import type { DecisionStore } from '../domain/store';

/** Everything a handler needs, wired once per invocation. */
export interface AppContext {
  settings: Settings;
  store: DecisionStore;
  /** Budget-metered Forge LLM. */
  llm: LlmPort;
  meter: KvsUsageMeter;
}

export async function loadContext(): Promise<AppContext> {
  const settings = await getSettings();
  const meter = new KvsUsageMeter(async () => settings.monthlyTokenBudget);
  return { settings, store: new SqlDecisionStore(), llm: new BudgetedLlm(new ForgeLlm(), meter), meter };
}

/** The LLM the guard may use, or undefined when an admin switched AI checks off. */
export function guardLlm(context: AppContext): LlmPort | undefined {
  return context.settings.ai.guard ? context.llm : undefined;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
