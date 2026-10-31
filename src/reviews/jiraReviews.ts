import type { ReviewPort } from '../domain/reviews';
import type { Decision } from '../domain/types';
import { bulletList, doc, heading, paragraph, strong } from '../integrations/adf';
import { createIssue } from '../integrations/jira';

export const REVIEW_LABELS = ['precedent', 'decision-review'];

/** Opens "Decision review" work items in Jira. */
export class JiraReviews implements ReviewPort {
  constructor(private readonly projectKey: string | undefined) {}

  async createReview(decision: Decision, evidence: string[], assigneeAccountId?: string): Promise<string | undefined> {
    const projectKey = this.projectKey ?? decision.linkedIssueKey?.split('-')[0];
    if (!projectKey) return undefined;
    const description = doc(
      paragraph(strong(`${decision.key}: ${decision.title}`)),
      paragraph(decision.statement),
      ...(decision.rationale ? [paragraph('Why it was decided: ', decision.rationale)] : []),
      heading(3, 'What changed'),
      bulletList(evidence),
      heading(3, 'What to do'),
      paragraph(
        'Re-ratify the decision if it still holds, or supersede it with a new one. Until then, Precedent flags it as under review ' +
          'to people and AI agents.',
      ),
    );
    return createIssue({
      projectKey,
      summary: `Decision review: ${decision.key} ${decision.title}`,
      description,
      labels: REVIEW_LABELS,
      assigneeAccountId,
    });
  }
}
