import { describe, expect, it } from 'vitest';
import {
  accountIdFromAri,
  columnNodes,
  latestGoalStatus,
  TeamworkGraph,
  userAri,
  type CypherResponse,
  type GraphNode,
} from '../../src/integrations/twg';

function listResponse(column: string, nodes: GraphNode[]): CypherResponse {
  return {
    data: {
      cypherQuery: {
        edges: [{ node: { columns: [{ key: column, value: { __typename: 'CypherQueryResultListNode', nodes } }] } }],
      },
    },
  };
}

describe('ARIs', () => {
  it('builds user ARIs and reads account ids back', () => {
    expect(userAri('712020:abc')).toBe('ari:cloud:identity::user/712020:abc');
    expect(accountIdFromAri('ari:cloud:identity::user/712020:abc')).toBe('712020:abc');
    expect(accountIdFromAri('ari:cloud:identity::team/123')).toBeUndefined();
  });
});

describe('columnNodes', () => {
  it('collects the nodes of the named column', () => {
    const response = listResponse('teams', [{ id: 't1' }, { id: 't2' }]);
    expect(columnNodes(response, 'teams').map((n) => n.id)).toEqual(['t1', 't2']);
    expect(columnNodes(response, 'other')).toEqual([]);
    expect(columnNodes({}, 'teams')).toEqual([]);
  });
});

describe('latestGoalStatus', () => {
  it('uses the newest update and ignores archived states', () => {
    expect(
      latestGoalStatus([
        { id: 'u1', data: { newState: 'ON_TRACK', createdAt: '2026-09-01T00:00:00Z' } },
        { id: 'u2', data: { newState: 'OFF_TRACK', createdAt: '2026-10-15T00:00:00Z' } },
        { id: 'u3', data: { newState: 'ARCHIVED', createdAt: '2026-10-20T00:00:00Z' } },
      ]),
    ).toBe('off_track');
    expect(latestGoalStatus([])).toBeUndefined();
  });
});

describe('TeamworkGraph', () => {
  it("queries a user's teams by ARI", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const graph = new TeamworkGraph(async (query, variables) => {
      calls.push(variables);
      expect(query).toContain('... on AtlassianTeam { id displayName }');
      return listResponse('teams', [{ id: 'ari:cloud:identity::team/1', data: { displayName: 'Payments' } }]);
    });
    expect(await graph.teamsOf('acc-1')).toEqual([{ id: 'ari:cloud:identity::team/1', name: 'Payments' }]);
    expect(calls[0]).toMatchObject({ params: { id: 'ari:cloud:identity::user/acc-1' } });
    expect(String(calls[0].cypherQuery)).toContain('atlassian_user_is_in_atlassian_team');
  });

  it("reads team members' account ids", async () => {
    const graph = new TeamworkGraph(async () =>
      listResponse('members', [{ id: 'ari:cloud:identity::user/a' }, { id: 'not-a-user' }, { id: 'ari:cloud:identity::user/b' }]),
    );
    expect(await graph.membersOf('ari:cloud:identity::team/1')).toEqual(['a', 'b']);
  });

  it('looks goals up by ARI or by name', async () => {
    const queries: string[] = [];
    const graph = new TeamworkGraph(async (_query, variables) => {
      queries.push(String(variables.cypherQuery));
      return listResponse('updates', [{ id: 'u', data: { newState: 'AT_RISK', createdAt: '2026-10-01T00:00:00Z' } }]);
    });
    expect(await graph.goalStatus('ari:cloud:townsquare::goal/9')).toBe('at_risk');
    expect(await graph.goalStatus('Launch in India')).toBe('at_risk');
    expect(queries[0]).toContain('{ari: $id}');
    expect(queries[1]).toContain('WHERE goal.name = $id');
  });
});
