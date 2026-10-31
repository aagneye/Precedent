import type { ReviewPort } from '../domain/reviews';
import type { DecisionStore } from '../domain/store';
import type { Decision } from '../domain/types';
import { evaluateWatch, type WatchContext } from './watchers';

export interface TripwireDeps {
  store: DecisionStore;
  lookups: Omit<WatchContext, 'today' | 'ownerAccountId'>;
  reviews: ReviewPort;
  successor(decision: Decision): Promise<string | undefined>;
  now(): Date;
}

export interface BrokenDecision {
  key: string;
  title: string;
  evidence: string[];
  reviewIssueKey?: string;
  assigneeAccountId?: string;
}

export interface SweepResult {
  decisions: number;
  checked: number;
  changed: number;
  broken: BrokenDecision[];
}

/**
 * Re-evaluates every watched assumption of the binding decisions. State changes are recorded as
 * tripwire events. When a ratified decision gets a newly broken assumption, it moves to
 * under review and a review work item goes to its owner, or to a successor if the owner is gone.
 */
export async function runTripwires(deps: TripwireDeps, decisionIds?: number[]): Promise<SweepResult> {
  const today = deps.now();
  const checkedAt = today.toISOString();
  const decisions = await deps.store.list({ statuses: ['ratified', 'under_review'], ids: decisionIds });
  const result: SweepResult = { decisions: decisions.length, checked: 0, changed: 0, broken: [] };

  for (const decision of decisions) {
    const newlyBroken: string[] = [];
    let ownerGone = false;
    for (const assumption of decision.assumptions) {
      const outcome = await evaluateWatch(assumption.watch, {
        ...deps.lookups,
        today,
        ownerAccountId: decision.ownerAccountId,
      });
      if (!outcome) continue;
      result.checked += 1;
      await deps.store.setAssumptionState(assumption.id, outcome.state, outcome.evidence, checkedAt);
      if (outcome.state === assumption.state) continue;
      result.changed += 1;
      await deps.store.addTripwireEvent({
        decisionId: decision.id,
        assumptionId: assumption.id,
        fromState: assumption.state,
        toState: outcome.state,
        evidence: outcome.evidence,
      });
      if (outcome.state === 'broken') {
        newlyBroken.push(`${assumption.text}: ${outcome.evidence}`);
        if (assumption.watch.type === 'owner') ownerGone = true;
      }
    }

    if (newlyBroken.length === 0 || decision.status !== 'ratified') continue;

    const assignee = ownerGone || !decision.ownerAccountId ? await deps.successor(decision) : decision.ownerAccountId;
    const reviewIssueKey = await deps.reviews.createReview(decision, newlyBroken, assignee);
    await deps.store.setStatus(decision.id, 'under_review');
    await deps.store.addTripwireEvent({
      decisionId: decision.id,
      toState: 'broken',
      evidence: newlyBroken.join('\n'),
      reviewIssueKey,
      successorAccountId: ownerGone ? assignee : undefined,
    });
    result.broken.push({
      key: decision.key,
      title: decision.title,
      evidence: newlyBroken,
      reviewIssueKey,
      assigneeAccountId: assignee,
    });
  }
  return result;
}
