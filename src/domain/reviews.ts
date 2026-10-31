import type { Decision } from './types';

/** Opens a review of a decision for a person to resolve. */
export interface ReviewPort {
  /** Opens a "Decision review" work item and returns its key, or undefined if it couldn't be created. */
  createReview(decision: Decision, evidence: string[], assigneeAccountId?: string): Promise<string | undefined>;
}
