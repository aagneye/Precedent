import type { Decision, NewDecision } from '../../src/domain/types';
import type { MemoryStore } from './memoryStore';

export type DecisionSeed = Partial<NewDecision> & Pick<NewDecision, 'title' | 'statement'>;

export function addDecision(store: MemoryStore, seed: DecisionSeed): Promise<Decision> {
  return store.create({ rationale: '', status: 'ratified', origin: 'user', tags: [], sources: [], assumptions: [], ...seed });
}

/** The Acme Pay decisions the guard tests check work against. */
export async function seedAcme(store: MemoryStore): Promise<void> {
  await addDecision(store, {
    title: 'Ledger stays on PostgreSQL',
    statement: 'We keep the ledger service on PostgreSQL.',
    rationale: 'Money movement needs ACID transactions.',
    tags: ['ledger-service', 'postgresql', 'database'],
  });
  await addDecision(store, {
    title: 'Single region until incidents demand more',
    statement: 'We run in one region (ap-south-1) and do not build multi-region failover yet.',
    tags: ['multi-region', 'infrastructure'],
  });
  await addDecision(store, {
    title: 'Outbound HTTP goes through acme-http',
    statement: 'We send all outbound HTTP calls through acme-http and add no new HTTP client libraries.',
    tags: ['acme-http', 'http-client', 'retries'],
  });
  await addDecision(store, {
    title: 'Draft idea: GraphQL gateway',
    statement: 'We expose a GraphQL gateway to partners.',
    tags: ['graphql'],
    status: 'candidate',
  });
}
