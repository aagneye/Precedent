import type { UsageSnapshot } from '../ai/llm';
import type { Settings } from '../config/settings';
import type { GuardResult } from '../guard/check';
import type { SpaceSummary } from '../integrations/confluence';
import type { ProjectSummary } from '../integrations/jira';
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

export interface SettingsView {
  settings: Settings;
  isAdmin: boolean;
  projects: ProjectSummary[];
  spaces: SpaceSummary[];
  usage: UsageSnapshot;
  /** Where external MCP clients connect, once a site admin has allowed it. */
  mcpUrl?: string;
}

export function isFailure(value: unknown): value is Failure {
  return typeof value === 'object' && value !== null && typeof (value as Failure).error === 'string';
}
