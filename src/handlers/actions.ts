import { loadContext } from '../app/context';
import type { CheckChannel } from '../domain/types';
import {
  formatCheck,
  formatIssueContext,
  formatRecorded,
  formatReview,
  formatSearch,
  formatUnderReview,
} from '../services/agentText';
import { checkIssue, checkPlan, listUnderReview, recordDecision, requestReview, searchDecisions } from '../services/decisions';

/**
 * Rovo actions. The same functions back the Rovo agent, the precedent-check skill and the MCP tools,
 * so every reply is plain text an agent can act on.
 */

interface ActionPayload {
  [input: string]: unknown;
  context?: { accountId?: string; jira?: { issueKey?: string } };
}

interface ActionContext {
  principal?: { accountId?: string };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value === undefined || value === null ? '' : String(value).trim();
}

function split(value: unknown, separator: RegExp): string[] {
  return text(value)
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean);
}

function actorOf(payload: ActionPayload, context?: ActionContext): string | undefined {
  return context?.principal?.accountId ?? payload.context?.accountId;
}

function issueKeyOf(payload: ActionPayload): string | undefined {
  return (text(payload.issueKey) || payload.context?.jira?.issueKey || '').toUpperCase() || undefined;
}

/** An agent that names itself is calling over MCP; otherwise it's Rovo. */
function channelOf(payload: ActionPayload): CheckChannel {
  return text(payload.agentName) ? 'mcp' : 'rovo';
}

export async function searchDecisionsAction(payload: ActionPayload): Promise<string> {
  const query = text(payload.query);
  if (!query) return 'Pass a query: a topic, a question, or a decision key like DEC-3.';
  const app = await loadContext();
  return formatSearch(query, await searchDecisions(app, query));
}

export async function checkPlanAction(payload: ActionPayload, context?: ActionContext): Promise<string> {
  const plan = text(payload.plan);
  if (!plan) return 'Pass the plan to check: what you intend to change and how.';
  const app = await loadContext();
  const actor = text(payload.agentName) || actorOf(payload, context);
  return formatCheck(await checkPlan(app, plan, channelOf(payload), actor, issueKeyOf(payload)));
}

export async function recordDecisionAction(payload: ActionPayload, context?: ActionContext): Promise<string> {
  const title = text(payload.title);
  const statement = text(payload.statement);
  if (!title || !statement) return 'Pass a title and a statement of what was decided.';
  const app = await loadContext();
  const decision = await recordDecision(app, {
    title,
    statement,
    rationale: text(payload.rationale),
    issueKey: issueKeyOf(payload),
    tags: split(payload.tags, /,/),
    assumptions: split(payload.assumptions, /\n|;/),
    agentName: text(payload.agentName) || 'Rovo',
    actorAccountId: actorOf(payload, context),
  });
  return formatRecorded(decision);
}

export async function getIssueContextAction(payload: ActionPayload, context?: ActionContext): Promise<string> {
  const issueKey = issueKeyOf(payload);
  if (!issueKey) return 'Pass a Jira work item key, like PAY-12.';
  const app = await loadContext();
  const checked = await checkIssue(app, issueKey, channelOf(payload), text(payload.agentName) || actorOf(payload, context));
  if (!checked) return `Couldn't find ${issueKey}, or the app can't read it.`;
  return formatIssueContext(checked.issue, checked.result);
}

export async function requestReviewAction(payload: ActionPayload): Promise<string> {
  const decisionKey = text(payload.decisionKey).toUpperCase();
  if (!decisionKey) return 'Pass the key of the decision to review, like DEC-3.';
  const app = await loadContext();
  const result = await requestReview(app, decisionKey, text(payload.reason), issueKeyOf(payload));
  return result ? formatReview(result.decision, result.reviewIssueKey) : `There's no decision ${decisionKey}.`;
}

export async function listUnderReviewAction(): Promise<string> {
  const app = await loadContext();
  return formatUnderReview(await listUnderReview(app));
}
