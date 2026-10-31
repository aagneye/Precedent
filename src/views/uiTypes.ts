import type { GuardResult } from '../guard/check';
import type { DecisionView, EventView } from './decisionView';

/** Response shapes shared by the UI resolvers and the UI Kit frontend. Type-only. */

export type Failure = { error: string };

export interface PanelView extends GuardResult {
  issueKey: string;
  issueSummary: string;
  checkedAt: string;
}

export interface DecisionList {
  decisions: DecisionView[];
}

export interface DecisionDetail {
  decision: DecisionView;
  events: EventView[];
}

export interface DecisionResult {
  decision: DecisionView;
  reviewIssueKey?: string;
}

export function isFailure(value: unknown): value is Failure {
  return typeof value === 'object' && value !== null && typeof (value as Failure).error === 'string';
}
