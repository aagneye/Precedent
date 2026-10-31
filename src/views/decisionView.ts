import { decisionHealth } from '../domain/health';
import type {
  AssumptionState,
  Decision,
  DecisionOrigin,
  DecisionSource,
  DecisionStatus,
  Health,
  TripwireEvent,
  Watch,
  WatchType,
} from '../domain/types';

/** Plain data the UI, Rovo and MCP receive. Shared by backend and frontend, so it must stay serializable. */
export interface AssumptionView {
  id: number;
  text: string;
  watchType: WatchType;
  watchSummary: string;
  state: AssumptionState;
  evidence?: string;
  lastCheckedAt?: string;
}

export interface DecisionView {
  id: number;
  key: string;
  title: string;
  statement: string;
  rationale: string;
  status: DecisionStatus;
  health: Health;
  origin: DecisionOrigin;
  originLabel?: string;
  ownerAccountId?: string;
  decidedAt?: string;
  linkedIssueKey?: string;
  tags: string[];
  sources: DecisionSource[];
  assumptions: AssumptionView[];
}

export interface EventView {
  decisionKey?: string;
  decisionTitle?: string;
  toState: AssumptionState;
  evidence: string;
  reviewIssueKey?: string;
  successorAccountId?: string;
  createdAt: string;
}

const OPERATORS = { gt: 'more than', gte: 'at least', lt: 'fewer than', lte: 'at most' } as const;

export function watchSummary(watch: Watch): string {
  switch (watch.type) {
    case 'owner':
      return 'Watched: the owner stays active';
    case 'date':
      return `Watched: expires on ${watch.expiresOn}`;
    case 'jql':
      return `Watched: breaks when ${OPERATORS[watch.operator]} ${watch.threshold} work items match \`${watch.jql}\``;
    case 'goal':
      return `Watched: goal "${watch.goal}" stays on track`;
    case 'manual':
      return 'Not checked automatically';
  }
}

export function toDecisionView(decision: Decision): DecisionView {
  return {
    id: decision.id,
    key: decision.key,
    title: decision.title,
    statement: decision.statement,
    rationale: decision.rationale,
    status: decision.status,
    health: decisionHealth(decision),
    origin: decision.origin,
    originLabel: decision.originLabel,
    ownerAccountId: decision.ownerAccountId,
    decidedAt: decision.decidedAt,
    linkedIssueKey: decision.linkedIssueKey,
    tags: decision.tags,
    sources: decision.sources,
    assumptions: decision.assumptions.map((a) => ({
      id: a.id,
      text: a.text,
      watchType: a.watch.type,
      watchSummary: watchSummary(a.watch),
      state: a.state,
      evidence: a.evidence,
      lastCheckedAt: a.lastCheckedAt,
    })),
  };
}

export function toEventView(event: TripwireEvent, decision?: Pick<Decision, 'key' | 'title'>): EventView {
  return {
    decisionKey: decision?.key,
    decisionTitle: decision?.title,
    toState: event.toState,
    evidence: event.evidence,
    reviewIssueKey: event.reviewIssueKey,
    successorAccountId: event.successorAccountId,
    createdAt: event.createdAt,
  };
}

/** A compact, model-friendly description of a decision for Rovo and MCP replies. */
export function describeDecision(view: DecisionView): string {
  const lines = [
    `${view.key} — ${view.title} [${view.status.replace('_', ' ')}, ${view.health.replace('_', ' ')}]`,
    `Statement: ${view.statement}`,
  ];
  if (view.rationale) lines.push(`Why: ${view.rationale}`);
  if (view.decidedAt) lines.push(`Decided: ${view.decidedAt}`);
  for (const a of view.assumptions) {
    lines.push(`Assumption (${a.state.replace('_', ' ')}): ${a.text}${a.evidence ? ` — ${a.evidence}` : ''}`);
  }
  for (const s of view.sources) if (s.url) lines.push(`Source: ${s.title ?? s.kind} ${s.url}`);
  return lines.join('\n');
}
