import type { Decision, Health } from './types';

const RANK: Record<Health, number> = { holding: 0, at_risk: 1, broken: 2 };

/**
 * A decision's health is its worst watched assumption. A decision under review is
 * broken until a person re-ratifies or supersedes it. Unknown states don't count.
 */
export function decisionHealth(decision: Pick<Decision, 'status' | 'assumptions'>): Health {
  if (decision.status === 'under_review') return 'broken';
  let worst: Health = 'holding';
  for (const assumption of decision.assumptions) {
    if (assumption.state === 'unknown') continue;
    if (RANK[assumption.state] > RANK[worst]) worst = assumption.state;
  }
  return worst;
}

export function healthCounts(decisions: Pick<Decision, 'status' | 'assumptions'>[]): Record<Health, number> {
  const counts: Record<Health, number> = { holding: 0, at_risk: 0, broken: 0 };
  for (const decision of decisions) counts[decisionHealth(decision)] += 1;
  return counts;
}
