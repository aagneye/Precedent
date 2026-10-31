import api from '@forge/api';
import type { Team } from '../tripwires/successor';
import type { GoalStatus } from '../tripwires/watchers';

/**
 * Teamwork Graph reads: who is on which team, and how goals are tracking.
 * Queries are Cypher wrapped in GraphQL, and only run on behalf of a user.
 */

const USER_ARI = 'ari:cloud:identity::user/';

export function userAri(accountId: string): string {
  return `${USER_ARI}${accountId}`;
}

export function accountIdFromAri(ari: string): string | undefined {
  return /(?:^|[:/])user\/([^/]+)$/.exec(ari)?.[1];
}

export interface GraphNode {
  id: string;
  data?: Record<string, unknown>;
}

export interface CypherResponse {
  data?: {
    cypherQuery?: {
      edges?: Array<{
        node?: { columns?: Array<{ key: string; value?: { __typename?: string; nodes?: GraphNode[] } | null }> };
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

export type GraphRequester = (query: string, variables: Record<string, unknown>) => Promise<CypherResponse>;

/** The GraphQL envelope for a Cypher query whose result columns are node lists. */
export function cypherDocument(fragment: string): string {
  return `query precedent_cypher($cypherQuery: String!, $params: CypherRequestParams) {
  cypherQuery(query: $cypherQuery, params: $params) {
    edges { node { columns { key value { __typename
      ... on CypherQueryResultListNode { nodes { id data { __typename ${fragment} } } }
    } } } }
  }
}`;
}

export function columnNodes(response: CypherResponse, column: string): GraphNode[] {
  const nodes: GraphNode[] = [];
  for (const edge of response.data?.cypherQuery?.edges ?? []) {
    for (const col of edge.node?.columns ?? []) {
      if (col.key === column) nodes.push(...(col.value?.nodes ?? []));
    }
  }
  return nodes;
}

const GOAL_STATUSES: GoalStatus[] = ['on_track', 'at_risk', 'off_track', 'done', 'paused', 'pending', 'cancelled'];

/** The status from a goal's most recent update, ignoring archived ones. */
export function latestGoalStatus(updates: GraphNode[]): GoalStatus | undefined {
  const latest = updates
    .map((node) => ({ state: String(node.data?.newState ?? '').toLowerCase(), at: String(node.data?.createdAt ?? '') }))
    .filter((u) => GOAL_STATUSES.includes(u.state as GoalStatus))
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  return latest?.state as GoalStatus | undefined;
}

export function forgeRequester(asAccountId?: string): GraphRequester {
  return async (query, variables) => {
    const client = asAccountId ? api.asUser(asAccountId) : api.asUser();
    const response = await client.requestTeamworkGraph(query, variables);
    if (!response.ok) throw new Error(`Teamwork Graph request failed (${response.status})`);
    const body = (await response.json()) as CypherResponse;
    if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
    return body;
  };
}

export class TeamworkGraph {
  constructor(private readonly request: GraphRequester) {}

  async teamsOf(accountId: string): Promise<Team[]> {
    const body = await this.request(cypherDocument('... on AtlassianTeam { id displayName }'), {
      cypherQuery:
        'MATCH (user:AtlassianUser {ari: $id})-[:atlassian_user_is_in_atlassian_team]->(team:AtlassianTeam) ' +
        'RETURN collect(distinct team) as teams',
      params: { id: userAri(accountId) },
    });
    return columnNodes(body, 'teams').map((node) => ({ id: node.id, name: String(node.data?.displayName ?? 'Team') }));
  }

  async membersOf(teamAri: string): Promise<string[]> {
    const body = await this.request(cypherDocument(''), {
      cypherQuery:
        'MATCH (user:AtlassianUser)-[:atlassian_user_is_in_atlassian_team]->(team:AtlassianTeam {ari: $id}) ' +
        'RETURN collect(distinct user) as members',
      params: { id: teamAri },
    });
    return columnNodes(body, 'members')
      .map((node) => accountIdFromAri(node.id))
      .filter((id): id is string => Boolean(id));
  }

  /** `goal` is a goal ARI or a goal's exact name. */
  async goalStatus(goal: string): Promise<GoalStatus | undefined> {
    const match = goal.startsWith('ari:')
      ? 'MATCH (goal:AtlassianGoal {ari: $id})'
      : 'MATCH (goal:AtlassianGoal) WHERE goal.name = $id WITH goal MATCH (goal)';
    const body = await this.request(cypherDocument('... on AtlassianGoalUpdate { newState createdAt }'), {
      cypherQuery: `${match}-[:atlassian_goal_has_atlassian_goal_update]->(update:AtlassianGoalUpdate) RETURN collect(update) as updates`,
      params: { id: goal },
    });
    return latestGoalStatus(columnNodes(body, 'updates'));
  }
}
