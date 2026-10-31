import { isUserActive } from '../integrations/jira';
import { forgeRequester, TeamworkGraph } from '../integrations/twg';
import type { Lookups } from './run';

function warn(what: string) {
  return (error: unknown) => {
    console.warn(`Teamwork Graph ${what} failed: ${(error as Error).message}`);
    return undefined;
  };
}

/**
 * Lookups backed by Teamwork Graph, run as the given user (or the current user in a UI call).
 * Any graph failure degrades to "no teams" or "unknown goal" rather than failing the sweep.
 */
export function graphLookups(asAccountId?: string): Lookups {
  const graph = new TeamworkGraph(forgeRequester(asAccountId));
  return {
    people: {
      teamsOf: async (accountId) => (await graph.teamsOf(accountId).catch(warn('team lookup'))) ?? [],
      membersOf: async (teamAri) => (await graph.membersOf(teamAri).catch(warn('member lookup'))) ?? [],
      isUserActive,
    },
    goalStatus: (goal) => graph.goalStatus(goal).catch(warn('goal lookup')),
  };
}
