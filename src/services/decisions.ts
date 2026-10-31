import { guardLlm, type AppContext } from '../app/context';
import { reviewProjectFor } from '../config/settings';
import type { CheckChannel, DecisionPatch, NewAssumption } from '../domain/types';
import { checkWork, type GuardResult } from '../guard/check';
import { OWNER_ASSUMPTION } from '../harvest/pipeline';
import { getIssue, issueUrl, type IssueSummary } from '../integrations/jira';
import { JiraReviews } from '../reviews/jiraReviews';
import { toDecisionView, type DecisionView } from '../views/decisionView';

/** Operations shared by the UI resolvers, the Rovo actions and the MCP tools. */

export function issueSubject(issue: IssueSummary): string {
  const parts = [`${issue.key}: ${issue.summary}`];
  if (issue.description) parts.push(issue.description);
  if (issue.labels.length) parts.push(`Labels: ${issue.labels.join(', ')}`);
  if (issue.components.length) parts.push(`Components: ${issue.components.join(', ')}`);
  return parts.join('\n');
}

export interface IssueCheck {
  issue: IssueSummary;
  result: GuardResult;
}

export async function checkIssue(
  context: AppContext,
  issueKey: string,
  channel: CheckChannel,
  actor?: string,
): Promise<IssueCheck | undefined> {
  const issue = await getIssue(issueKey);
  if (!issue) return undefined;
  const result = await checkWork(issueSubject(issue), { store: context.store, llm: guardLlm(context) }, { channel, actor, limit: 8 });
  return { issue, result };
}

export async function checkPlan(
  context: AppContext,
  plan: string,
  channel: CheckChannel,
  actor?: string,
  issueKey?: string,
): Promise<GuardResult> {
  const issue = issueKey ? await getIssue(issueKey) : undefined;
  const subject = issue ? `${plan}\n\nContext from ${issueSubject(issue)}` : plan;
  return checkWork(subject, { store: context.store, llm: guardLlm(context) }, { channel, actor, limit: 8 });
}

/** Makes a candidate binding. Fills in the owner if it's missing and makes sure the owner is watched. */
export async function ratify(
  context: AppContext,
  id: number,
  actorAccountId?: string,
  patch?: DecisionPatch,
): Promise<DecisionView | undefined> {
  if (patch) await context.store.update(id, patch);
  const decision = await context.store.get(id);
  if (!decision) return undefined;
  if (!decision.ownerAccountId && actorAccountId) await context.store.update(id, { ownerAccountId: actorAccountId });
  if (!decision.assumptions.some((a) => a.watch.type === 'owner')) await context.store.addAssumption(id, OWNER_ASSUMPTION);
  await context.store.setStatus(id, 'ratified');
  const ratified = await context.store.get(id);
  return ratified && toDecisionView(ratified);
}

export interface ReviewRequest {
  decision: DecisionView;
  reviewIssueKey?: string;
}

/** Opens a review of a decision on request (rather than from a tripwire) and flags it as under review. */
export async function requestReview(
  context: AppContext,
  decisionKey: string,
  reason: string,
  issueKey?: string,
): Promise<ReviewRequest | undefined> {
  const decision = await context.store.getByKey(decisionKey);
  if (!decision) return undefined;
  const evidence = `Review requested${issueKey ? ` from ${issueKey}` : ''}: ${reason || 'no reason given'}`;
  const reviews = new JiraReviews(reviewProjectFor(context.settings) ?? issueKey?.split('-')[0]);
  const reviewIssueKey = await reviews.createReview(decision, [evidence], decision.ownerAccountId);
  if (decision.status === 'ratified') await context.store.setStatus(decision.id, 'under_review');
  await context.store.addTripwireEvent({ decisionId: decision.id, toState: 'at_risk', evidence, reviewIssueKey });
  const updated = await context.store.get(decision.id);
  return updated && { decision: toDecisionView(updated), reviewIssueKey };
}

export interface RecordInput {
  title: string;
  statement: string;
  rationale?: string;
  issueKey?: string;
  tags?: string[];
  assumptions?: string[];
  agentName?: string;
  actorAccountId?: string;
}

/** Files a decision an agent (or person) made while working, as a candidate awaiting ratification. */
export async function recordDecision(context: AppContext, input: RecordInput): Promise<DecisionView> {
  const agent = input.agentName?.trim() || 'an AI agent';
  const issueKey = input.issueKey?.trim().toUpperCase() || undefined;
  const assumptions: NewAssumption[] = [
    OWNER_ASSUMPTION,
    ...(input.assumptions ?? []).filter((text) => text.trim().length >= 3).map((text) => ({ text: text.trim(), watch: { type: 'manual' as const } })),
  ];
  const decision = await context.store.create({
    title: input.title.trim(),
    statement: input.statement.trim(),
    rationale: input.rationale?.trim() ?? '',
    status: 'candidate',
    origin: 'agent',
    originLabel: `Recorded by ${agent}${issueKey ? ` while working on ${issueKey}` : ''}`,
    ownerAccountId: input.actorAccountId,
    deciders: input.actorAccountId ? [input.actorAccountId] : [],
    decidedAt: new Date().toISOString().slice(0, 10),
    linkedIssueKey: issueKey,
    tags: input.tags ?? [],
    sources: [
      {
        kind: 'agent_session',
        ref: `${agent}:${Date.now()}`,
        url: issueKey ? await issueUrl(issueKey) : undefined,
        title: `${agent}${issueKey ? ` on ${issueKey}` : ''}`,
        excerpt: input.statement.slice(0, 400),
      },
    ],
    assumptions,
  });
  return toDecisionView(decision);
}
