export interface Team {
  id: string;
  name: string;
}

/** People lookups, answered from Teamwork Graph with Jira as a fallback. */
export interface PeoplePort {
  teamsOf(accountId: string): Promise<Team[]>;
  membersOf(teamId: string): Promise<string[]>;
  isUserActive(accountId: string): Promise<boolean | undefined>;
}

/**
 * Who should steward a decision whose owner is gone: first an active teammate of the owner,
 * then one of the original deciders. Undefined if nobody suitable is found.
 */
export async function suggestSuccessor(
  ownerAccountId: string,
  deciders: string[],
  people: PeoplePort,
): Promise<string | undefined> {
  const tried = new Set<string>([ownerAccountId]);
  const isCandidate = async (accountId: string): Promise<boolean> => {
    if (tried.has(accountId)) return false;
    tried.add(accountId);
    return (await people.isUserActive(accountId)) === true;
  };

  for (const team of await people.teamsOf(ownerAccountId)) {
    for (const member of await people.membersOf(team.id)) {
      if (await isCandidate(member)) return member;
    }
  }
  for (const decider of deciders) {
    if (await isCandidate(decider)) return decider;
  }
  return undefined;
}
