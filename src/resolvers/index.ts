import Resolver from '@forge/resolver';
import { loadContext } from '../app/context';
import { DECISION_STATUSES, type DecisionPatch, type DecisionStatus } from '../domain/types';
import { doc, paragraph, strong } from '../integrations/adf';
import { addComment } from '../integrations/jira';
import { checkIssue, ratify, requestReview } from '../services/decisions';
import { sweepTripwires } from '../tripwires/run';
import { toDecisionView, toEventView } from '../views/decisionView';
import type { DecisionDetail, Failure, PanelView } from '../views/uiTypes';

interface UiContext {
  accountId?: string;
  extension?: { issue?: { key?: string } };
}

const resolver = new Resolver();

function issueKeyFrom(payload: { issueKey?: string } | undefined, context: UiContext): string {
  return String(payload?.issueKey ?? context.extension?.issue?.key ?? '').toUpperCase();
}

function asStatus(value: unknown): DecisionStatus | undefined {
  return DECISION_STATUSES.includes(value as DecisionStatus) ? (value as DecisionStatus) : undefined;
}

function asPatch(value: unknown): DecisionPatch | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  const patch: DecisionPatch = {};
  if (typeof input.title === 'string' && input.title.trim()) patch.title = input.title.trim();
  if (typeof input.statement === 'string' && input.statement.trim()) patch.statement = input.statement.trim();
  if (typeof input.rationale === 'string') patch.rationale = input.rationale.trim();
  if (typeof input.ownerAccountId === 'string') patch.ownerAccountId = input.ownerAccountId;
  if (Array.isArray(input.tags)) patch.tags = input.tags.filter((t): t is string => typeof t === 'string');
  return patch;
}

// Issue panel

resolver.define('panel.check', async ({ payload, context }): Promise<PanelView | Failure> => {
  const issueKey = issueKeyFrom(payload, context as UiContext);
  const app = await loadContext();
  const checked = await checkIssue(app, issueKey, 'panel', (context as UiContext).accountId);
  if (!checked) return { error: `Couldn't read ${issueKey}.` };
  return { issueKey, issueSummary: checked.issue.summary, checkedAt: new Date().toISOString(), ...checked.result };
});

resolver.define('panel.override', async ({ payload, context }) => {
  const issueKey = issueKeyFrom(payload, context as UiContext);
  const decisionKey = String(payload?.decisionKey ?? '');
  const reason = String(payload?.reason ?? '').trim();
  const app = await loadContext();
  const decision = await app.store.getByKey(decisionKey);
  if (!decision) return { error: `Unknown decision ${decisionKey}.` };
  await addComment(
    issueKey,
    doc(
      paragraph(strong('Precedent: '), `Proceeding despite ${decision.key} (${decision.title}).`),
      paragraph(`Reason: ${reason || 'none given'}`),
    ),
  );
  await app.store.logCheck({
    channel: 'panel',
    actor: (context as UiContext).accountId,
    subject: `Override of ${decision.key} on ${issueKey}: ${reason}`,
    conflicts: 1,
    decisionKeys: [decision.key],
  });
  return { ok: true };
});

resolver.define('decision.requestReview', async ({ payload }) => {
  const app = await loadContext();
  const result = await requestReview(app, String(payload?.decisionKey ?? ''), String(payload?.reason ?? ''), payload?.issueKey);
  return result ?? { error: `Unknown decision ${payload?.decisionKey}.` };
});

// Inbox and decisions

resolver.define('inbox.list', async () => {
  const app = await loadContext();
  const candidates = await app.store.list({ statuses: ['candidate'], limit: 100 });
  return { decisions: candidates.map(toDecisionView) };
});

resolver.define('decision.ratify', async ({ payload, context }) => {
  const app = await loadContext();
  const view = await ratify(app, Number(payload?.id), (context as UiContext).accountId, asPatch(payload?.patch));
  return view ? { decision: view } : { error: 'Decision not found.' };
});

resolver.define('decision.update', async ({ payload }) => {
  const app = await loadContext();
  const patch = asPatch(payload?.patch);
  const updated = patch ? await app.store.update(Number(payload?.id), patch) : undefined;
  return updated ? { decision: toDecisionView(updated) } : { error: 'Nothing to update.' };
});

/** Re-ratify, retire (superseded) or dismiss. Reviews go through decision.requestReview instead. */
resolver.define('decision.setStatus', async ({ payload, context }) => {
  const status = asStatus(payload?.status);
  const app = await loadContext();
  const id = Number(payload?.id);
  if (status === 'ratified') {
    const view = await ratify(app, id, (context as UiContext).accountId);
    return view ? { decision: view } : { error: 'Decision not found.' };
  }
  if (status !== 'superseded' && status !== 'dismissed') return { error: `Can't set status to ${payload?.status}.` };
  await app.store.setStatus(id, status, typeof payload?.supersededBy === 'string' ? payload.supersededBy : undefined);
  const updated = await app.store.get(id);
  return updated ? { decision: toDecisionView(updated) } : { error: 'Decision not found.' };
});

resolver.define('decisions.list', async ({ payload }) => {
  const app = await loadContext();
  const status = asStatus(payload?.status);
  const decisions = await app.store.list({
    statuses: status ? [status] : ['ratified', 'under_review', 'superseded'],
    text: typeof payload?.text === 'string' ? payload.text : undefined,
    limit: 200,
  });
  return { decisions: decisions.map(toDecisionView) };
});

resolver.define('decision.detail', async ({ payload }): Promise<DecisionDetail | Failure> => {
  const app = await loadContext();
  const decision = await app.store.get(Number(payload?.id));
  if (!decision) return { error: 'Decision not found.' };
  const events = await app.store.listTripwireEvents(decision.id, 20);
  return { decision: toDecisionView(decision), events: events.map((e) => toEventView(e, decision)) };
});

// Tripwires

resolver.define('tripwires.runNow', async () => {
  const app = await loadContext();
  return sweepTripwires(app);
});

export const uiResolver = resolver.getDefinitions();
