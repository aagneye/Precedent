import { kvs } from '@forge/kvs';
import type { UsageMeter, UsageSnapshot } from './llm';

interface UsageRecord {
  tokens: number;
  calls: number;
}

export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Monthly AI token usage kept in Forge KVS. Counts are approximate under concurrent calls. */
export class KvsUsageMeter implements UsageMeter {
  constructor(
    private readonly budget: () => Promise<number>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private key(): string {
    return `usage:${monthKey(this.now())}`;
  }

  async snapshot(): Promise<UsageSnapshot> {
    const record = (await kvs.get<UsageRecord>(this.key())) ?? { tokens: 0, calls: 0 };
    return { month: monthKey(this.now()), tokens: record.tokens, calls: record.calls, budget: await this.budget() };
  }

  async record(tokens: number): Promise<void> {
    const key = this.key();
    const record = (await kvs.get<UsageRecord>(key)) ?? { tokens: 0, calls: 0 };
    await kvs.set<UsageRecord>(key, { tokens: record.tokens + tokens, calls: record.calls + 1 });
  }
}
