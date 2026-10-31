import { describe, expect, it } from 'vitest';
import { decisionHealth, healthCounts } from '../../src/domain/health';
import type { Assumption, AssumptionState, DecisionStatus } from '../../src/domain/types';

function assumption(state: AssumptionState): Assumption {
  return { id: 1, decisionId: 1, text: 'x', watch: { type: 'manual' }, state };
}

function decision(status: DecisionStatus, states: AssumptionState[]) {
  return { status, assumptions: states.map(assumption) };
}

describe('decisionHealth', () => {
  it('is holding with no assumptions', () => {
    expect(decisionHealth(decision('ratified', []))).toBe('holding');
  });

  it('takes the worst assumption and ignores unknown ones', () => {
    expect(decisionHealth(decision('ratified', ['holding', 'at_risk', 'unknown']))).toBe('at_risk');
    expect(decisionHealth(decision('ratified', ['at_risk', 'broken']))).toBe('broken');
    expect(decisionHealth(decision('ratified', ['unknown']))).toBe('holding');
  });

  it('treats a decision under review as broken', () => {
    expect(decisionHealth(decision('under_review', ['holding']))).toBe('broken');
  });
});

describe('healthCounts', () => {
  it('counts each health bucket', () => {
    const counts = healthCounts([
      decision('ratified', ['holding']),
      decision('ratified', ['at_risk']),
      decision('under_review', []),
      decision('ratified', []),
    ]);
    expect(counts).toEqual({ holding: 2, at_risk: 1, broken: 1 });
  });
});
