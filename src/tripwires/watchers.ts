import type { AssumptionState, JqlOperator, Watch } from '../domain/types';

export type GoalStatus = 'on_track' | 'at_risk' | 'off_track' | 'done' | 'paused' | 'pending' | 'cancelled';

/** What a watcher can look up. Each lookup returns undefined when the answer can't be found. */
export interface WatchContext {
  today: Date;
  ownerAccountId?: string;
  isUserActive(accountId: string): Promise<boolean | undefined>;
  countJql(jql: string): Promise<number | undefined>;
  goalStatus(goal: string): Promise<GoalStatus | undefined>;
}

export interface WatchResult {
  state: AssumptionState;
  evidence: string;
}

const DAY_MS = 86_400_000;
const DEFAULT_WARN_DAYS = 14;

function startOfDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

async function watchOwner(ctx: WatchContext): Promise<WatchResult> {
  if (!ctx.ownerAccountId) return { state: 'unknown', evidence: 'No owner is recorded for this decision.' };
  const active = await ctx.isUserActive(ctx.ownerAccountId);
  if (active === undefined) return { state: 'unknown', evidence: "Couldn't look up the owner's account." };
  return active
    ? { state: 'holding', evidence: 'The owner is still active.' }
    : { state: 'broken', evidence: 'The owner is no longer active, so nobody stewards this decision.' };
}

function watchDate(expiresOn: string, warnDays: number | undefined, today: Date): WatchResult {
  const expires = Date.parse(`${expiresOn}T00:00:00Z`);
  if (Number.isNaN(expires)) return { state: 'unknown', evidence: `"${expiresOn}" isn't a valid date.` };
  const daysLeft = Math.round((expires - startOfDay(today)) / DAY_MS);
  if (daysLeft < 0) return { state: 'broken', evidence: `Expired on ${expiresOn}.` };
  if (daysLeft <= (warnDays ?? DEFAULT_WARN_DAYS)) {
    return { state: 'at_risk', evidence: `Expires on ${expiresOn}, in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.` };
  }
  return { state: 'holding', evidence: `Valid until ${expiresOn}.` };
}

const OPERATOR_TEXT: Record<JqlOperator, string> = { gt: 'more than', gte: 'at least', lt: 'fewer than', lte: 'at most' };

/** The watch's operator and threshold describe when the assumption BREAKS. */
export function jqlState(count: number, operator: JqlOperator, threshold: number): AssumptionState {
  const margin = Math.max(1, Math.ceil(Math.abs(threshold) * 0.2));
  switch (operator) {
    case 'gt':
      return count > threshold ? 'broken' : count > threshold - margin ? 'at_risk' : 'holding';
    case 'gte':
      return count >= threshold ? 'broken' : count >= threshold - margin ? 'at_risk' : 'holding';
    case 'lt':
      return count < threshold ? 'broken' : count < threshold + margin ? 'at_risk' : 'holding';
    case 'lte':
      return count <= threshold ? 'broken' : count <= threshold + margin ? 'at_risk' : 'holding';
  }
}

async function watchJql(jql: string, operator: JqlOperator, threshold: number, ctx: WatchContext): Promise<WatchResult> {
  const count = await ctx.countJql(jql);
  if (count === undefined) return { state: 'unknown', evidence: `Couldn't run the JQL query: ${jql}` };
  return {
    state: jqlState(count, operator, threshold),
    evidence: `${count} work item${count === 1 ? '' : 's'} match (breaks at ${OPERATOR_TEXT[operator]} ${threshold}).`,
  };
}

const GOAL_STATES: Record<GoalStatus, WatchResult['state']> = {
  on_track: 'holding',
  pending: 'holding',
  paused: 'at_risk',
  at_risk: 'at_risk',
  done: 'at_risk',
  off_track: 'broken',
  cancelled: 'broken',
};

async function watchGoal(goal: string, ctx: WatchContext): Promise<WatchResult> {
  const status = await ctx.goalStatus(goal);
  if (!status) return { state: 'unknown', evidence: `Couldn't find the goal "${goal}".` };
  const label = status.replace('_', ' ');
  const extra = status === 'done' ? ' Check the decision still applies now the goal is met.' : '';
  return { state: GOAL_STATES[status], evidence: `Goal "${goal}" is ${label}.${extra}` };
}

/** Evaluates one assumption's watch. Returns undefined for manual watches, which are never checked. */
export async function evaluateWatch(watch: Watch, ctx: WatchContext): Promise<WatchResult | undefined> {
  switch (watch.type) {
    case 'owner':
      return watchOwner(ctx);
    case 'date':
      return watchDate(watch.expiresOn, watch.warnDays, ctx.today);
    case 'jql':
      return watchJql(watch.jql, watch.operator, watch.threshold, ctx);
    case 'goal':
      return watchGoal(watch.goal, ctx);
    case 'manual':
      return undefined;
  }
}
