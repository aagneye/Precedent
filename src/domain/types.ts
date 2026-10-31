export const DECISION_STATUSES = ['candidate', 'ratified', 'under_review', 'superseded', 'dismissed'] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

/** Statuses that make a decision binding: the guard checks work against these. */
export const BINDING_STATUSES: DecisionStatus[] = ['ratified', 'under_review'];

export const DECISION_ORIGINS = ['harvest', 'agent', 'user', 'demo'] as const;
export type DecisionOrigin = (typeof DECISION_ORIGINS)[number];

export const SOURCE_KINDS = ['confluence_page', 'jira_comment', 'jira_issue', 'agent_session', 'manual'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const ASSUMPTION_STATES = ['holding', 'at_risk', 'broken', 'unknown'] as const;
export type AssumptionState = (typeof ASSUMPTION_STATES)[number];

export type Health = 'holding' | 'at_risk' | 'broken';

export type JqlOperator = 'gt' | 'gte' | 'lt' | 'lte';

/** How an assumption is watched. `manual` assumptions are shown but never checked automatically. */
export type Watch =
  | { type: 'owner' }
  | { type: 'date'; expiresOn: string; warnDays?: number }
  | { type: 'jql'; jql: string; operator: JqlOperator; threshold: number }
  | { type: 'goal'; goal: string }
  | { type: 'manual' };

export type WatchType = Watch['type'];

export interface DecisionSource {
  kind: SourceKind;
  ref: string;
  url?: string;
  title?: string;
  excerpt?: string;
}

export interface Assumption {
  id: number;
  decisionId: number;
  text: string;
  watch: Watch;
  state: AssumptionState;
  lastCheckedAt?: string;
  evidence?: string;
}

export interface Decision {
  id: number;
  key: string;
  title: string;
  statement: string;
  rationale: string;
  status: DecisionStatus;
  origin: DecisionOrigin;
  ownerAccountId?: string;
  deciders: string[];
  decidedAt?: string;
  linkedIssueKey?: string;
  supersededBy?: string;
  /** Free-form label, e.g. the agent that recorded the decision. */
  originLabel?: string;
  tags: string[];
  sources: DecisionSource[];
  assumptions: Assumption[];
  createdAt: string;
  updatedAt: string;
}

export interface NewAssumption {
  text: string;
  watch: Watch;
}

export interface NewDecision {
  title: string;
  statement: string;
  rationale: string;
  status: DecisionStatus;
  origin: DecisionOrigin;
  originLabel?: string;
  ownerAccountId?: string;
  deciders?: string[];
  decidedAt?: string;
  linkedIssueKey?: string;
  tags: string[];
  sources: DecisionSource[];
  assumptions: NewAssumption[];
}

export type DecisionPatch = Partial<
  Pick<Decision, 'title' | 'statement' | 'rationale' | 'ownerAccountId' | 'decidedAt' | 'tags' | 'linkedIssueKey'>
>;

export interface TripwireEvent {
  id: number;
  decisionId: number;
  assumptionId?: number;
  fromState?: AssumptionState;
  toState: AssumptionState;
  evidence: string;
  reviewIssueKey?: string;
  successorAccountId?: string;
  createdAt: string;
}

export type NewTripwireEvent = Omit<TripwireEvent, 'id' | 'createdAt'>;

export type CheckChannel = 'panel' | 'rovo' | 'mcp' | 'skill';

export type Verdict = 'conflict' | 'relevant' | 'irrelevant';

export interface CheckLogEntry {
  channel: CheckChannel;
  actor?: string;
  subject: string;
  conflicts: number;
  decisionKeys: string[];
}
