import type { AppContext } from '../app/context';
import { reviewProjectFor } from '../config/settings';
import { countJql, isUserActive } from '../integrations/jira';
import { JiraReviews } from '../reviews/jiraReviews';
import { runTripwires, type SweepResult } from './engine';
import { suggestSuccessor, type PeoplePort } from './successor';
import type { GoalStatus } from './watchers';

export interface Lookups {
  people: PeoplePort;
  goalStatus(goal: string): Promise<GoalStatus | undefined>;
}

/** Jira-only lookups: owner status from the user API, no teams and no goals. */
export const jiraLookups: Lookups = {
  people: {
    teamsOf: async () => [],
    membersOf: async () => [],
    isUserActive,
  },
  goalStatus: async () => undefined,
};

/** Runs every tripwire (or just the given decisions'), opening reviews for newly broken decisions. */
export async function sweepTripwires(app: AppContext, lookups: Lookups = jiraLookups, decisionIds?: number[]): Promise<SweepResult> {
  return runTripwires(
    {
      store: app.store,
      lookups: { isUserActive: lookups.people.isUserActive, countJql, goalStatus: lookups.goalStatus },
      reviews: new JiraReviews(reviewProjectFor(app.settings)),
      successor: async (decision) =>
        decision.ownerAccountId ? suggestSuccessor(decision.ownerAccountId, decision.deciders, lookups.people) : undefined,
      now: () => new Date(),
    },
    decisionIds,
  );
}
