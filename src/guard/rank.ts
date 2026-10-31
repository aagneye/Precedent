import { parseDecisionKey } from '../domain/keys';
import { tokenize } from '../domain/tags';
import { BINDING_STATUSES, type Decision } from '../domain/types';

export interface RankQuery {
  tags: string[];
  keywords: string[];
}

export interface RankedDecision {
  decision: Decision;
  score: number;
  matchedTags: string[];
  matchedKeywords: string[];
}

const TAG_WEIGHT = 3;
const KEYWORD_WEIGHT = 1;

/** Scores binding decisions by tag overlap (strong) and shared words (weak), best first. */
export function rankDecisions(query: RankQuery, decisions: Decision[], limit = 15): RankedDecision[] {
  const queryTags = new Set(query.tags);
  const queryWords = new Set(query.keywords);
  const ranked: RankedDecision[] = [];
  for (const decision of decisions) {
    if (!BINDING_STATUSES.includes(decision.status)) continue;
    const matchedTags = decision.tags.filter((tag) => queryTags.has(tag) || queryWords.has(tag));
    const words = new Set(tokenize(`${decision.title} ${decision.statement}`));
    const matchedKeywords = [...queryWords].filter((word) => words.has(word) && !matchedTags.includes(word));
    const score = matchedTags.length * TAG_WEIGHT + matchedKeywords.length * KEYWORD_WEIGHT;
    if (score > 0) ranked.push({ decision, score, matchedTags, matchedKeywords });
  }
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      (parseDecisionKey(a.decision.key) ?? 0) - (parseDecisionKey(b.decision.key) ?? 0),
  );
  return ranked.slice(0, limit);
}

/** Without AI, only strong matches are worth showing: a shared tag, or at least two shared words. */
export function isStrongMatch(ranked: RankedDecision): boolean {
  return ranked.matchedTags.length > 0 || ranked.matchedKeywords.length >= 2;
}
