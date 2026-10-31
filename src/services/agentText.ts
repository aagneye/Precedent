import type { Finding, GuardResult } from '../guard/check';
import type { IssueSummary } from '../integrations/jira';
import { describeDecision, type DecisionView } from '../views/decisionView';
import type { UnderReview } from './decisions';

/** Plain-text replies for Rovo and MCP clients. Agents read these, so they lead with what to do. */

function underReviewNote(finding: Pick<Finding, 'status'>): string {
  return finding.status === 'under_review' ? ' (This decision is under review and may change; ask its owner before relying on it.)' : '';
}

export function formatSearch(query: string, decisions: DecisionView[]): string {
  if (decisions.length === 0) {
    return `No ratified decisions match "${query}". The team may not have decided this yet: say so rather than guessing.`;
  }
  return [`${decisions.length} decision${decisions.length === 1 ? '' : 's'} match "${query}":`, ...decisions.map(describeDecision)].join(
    '\n\n',
  );
}

export function formatFindings(result: GuardResult): string {
  const lines: string[] = [];
  for (const f of result.findings) {
    const label = f.verdict === 'conflict' ? 'CONFLICT' : 'APPLIES';
    const suggestion = f.suggestion ? ` Suggested approach: ${f.suggestion}` : '';
    lines.push(`${label} ${f.key} — ${f.title}: ${f.reason}${suggestion}${underReviewNote(f)}`);
    lines.push(`  Decision: ${f.statement}${f.rationale ? ` Why: ${f.rationale}` : ''}`);
  }
  return lines.join('\n');
}

export function formatCheck(result: GuardResult): string {
  const note = result.note ? `\nNote: ${result.note}` : '';
  if (result.findings.length === 0) return `No team decisions apply to this plan. Proceed.${note}`;
  const guidance =
    result.conflicts > 0
      ? 'Do not go ahead with the conflicting parts. Change the plan so it respects these decisions, or ask the user to request a review of the decision in Precedent.'
      : 'No conflicts. Follow these decisions while you do the work.';
  return `${guidance}\n\n${formatFindings(result)}${note}`;
}

export function formatRecorded(decision: DecisionView): string {
  return `Recorded ${decision.key} "${decision.title}" as a candidate decision. A teammate ratifies it in Precedent's inbox before it becomes binding.`;
}

export function formatReview(decision: DecisionView, reviewIssueKey?: string): string {
  return `${decision.key} is now under review.${reviewIssueKey ? ` Review work item: ${reviewIssueKey}.` : ''} Its owner decides whether to re-ratify or supersede it.`;
}

export function formatUnderReview(items: UnderReview[]): string {
  if (items.length === 0) return 'No decisions are under review. Every ratified decision is holding.';
  return items
    .map(({ decision, latestEvidence, reviewIssueKey }) =>
      [
        `${decision.key} — ${decision.title}`,
        `  Decision: ${decision.statement}`,
        latestEvidence ? `  What changed: ${latestEvidence}` : undefined,
        reviewIssueKey ? `  Review: ${reviewIssueKey}` : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}

export function formatIssueContext(issue: IssueSummary, result: GuardResult, extra: string[] = []): string {
  const description = issue.description ? `\n${issue.description.slice(0, 1200)}` : '';
  const decisions = result.findings.length
    ? `Team decisions that apply:\n${formatFindings(result)}`
    : 'No team decisions apply to this work item.';
  return [`${issue.key}: ${issue.summary} [${issue.status ?? 'unknown status'}]${description}`, decisions, ...extra].join('\n\n');
}
