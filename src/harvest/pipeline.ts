import { parseEach } from '../ai/json';
import { completeJson, type LlmPort } from '../ai/llm';
import {
  buildExtractPrompt,
  EXTRACT_SYSTEM,
  ExtractedDecisionSchema,
  ExtractionEnvelopeSchema,
  type ExtractedDecision,
} from '../ai/prompts';
import { jaccard, isNearDuplicate } from '../domain/similarity';
import type { DecisionStore } from '../domain/store';
import type { NewAssumption, SourceKind, Watch } from '../domain/types';

export interface HarvestItem {
  kind: Extract<SourceKind, 'confluence_page' | 'jira_comment'>;
  ref: string;
  url?: string;
  title: string;
  text: string;
  authorAccountId?: string;
  createdAt?: string;
  projectKey?: string;
  linkedIssueKey?: string;
}

export interface HarvestDeps {
  store: DecisionStore;
  llm: LlmPort;
  today(): string;
}

export interface HarvestResult {
  created: string[];
  skipped?: string;
}

const MIN_CONFIDENCE = 0.5;
const MIN_LENGTH = 40;
const DECISION_CUES =
  /\b(decided|decision|decisions|we will|we'll|we won't|we will not|agreed|agree to|going with|go with|chose|choose|selected|standardi[sz]e|must not|must|never|always|adr|accepted|policy|from now on)\b/i;

/** Cheap gate before spending AI tokens: does the text use decision language at all? */
export function looksLikeDecision(text: string): boolean {
  return text.trim().length >= MIN_LENGTH && DECISION_CUES.test(text);
}

export const OWNER_ASSUMPTION: NewAssumption = {
  text: 'Its owner is still here to steward it',
  watch: { type: 'owner' },
};

/** Fills a JQL placeholder project key with the source's project; drops JQL watches it can't resolve. */
export function resolveWatch(watch: Watch, projectKey?: string): Watch {
  if (watch.type !== 'jql') return watch;
  const placeholder = /\bproject\s*=\s*(KEY|PROJECT)\b/i;
  if (!placeholder.test(watch.jql)) return watch;
  return projectKey ? { ...watch, jql: watch.jql.replace(placeholder, `project = ${projectKey}`) } : { type: 'manual' };
}

/** The sentence of the source that best matches the decision, as evidence. */
export function excerptFor(text: string, statement: string): string {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 0);
  let best = sentences[0] ?? '';
  let bestScore = -1;
  for (const sentence of sentences) {
    const score = jaccard(sentence, statement);
    if (score > bestScore) {
      best = sentence;
      bestScore = score;
    }
  }
  return best.slice(0, 400);
}

function toNewAssumptions(decision: ExtractedDecision, projectKey?: string): NewAssumption[] {
  return [OWNER_ASSUMPTION, ...decision.assumptions.map((a) => ({ text: a.text, watch: resolveWatch(a.watch, projectKey) }))];
}

/**
 * Extracts decisions from one page or comment and files them as candidates in the inbox.
 * Skips sources already harvested, text without decision language, and near-duplicates of known decisions.
 */
export async function harvestItem(item: HarvestItem, deps: HarvestDeps): Promise<HarvestResult> {
  if (!looksLikeDecision(item.text)) return { created: [], skipped: 'No decision language found.' };
  if (await deps.store.sourceExists(item.kind, item.ref)) return { created: [], skipped: 'Already harvested.' };

  const reply = await completeJson(
    deps.llm,
    {
      tier: 'smart',
      system: EXTRACT_SYSTEM,
      prompt: buildExtractPrompt(
        {
          kindLabel: item.kind === 'confluence_page' ? 'Confluence page' : 'Jira comment',
          title: item.title,
          createdAt: item.createdAt?.slice(0, 10),
          projectKey: item.projectKey,
          text: item.text,
        },
        deps.today(),
      ),
      maxTokens: 3000,
    },
    ExtractionEnvelopeSchema,
  );
  if (!reply.ok) return { created: [], skipped: `The AI reply couldn't be read: ${reply.error}` };

  const extracted = parseEach(reply.value.decisions, ExtractedDecisionSchema).filter((d) => d.confidence >= MIN_CONFIDENCE);
  const known = await deps.store.list({ statuses: ['candidate', 'ratified', 'under_review'], limit: 500 });
  const statements = known.map((d) => d.statement);
  const created: string[] = [];

  for (const decision of extracted) {
    if (statements.some((s) => isNearDuplicate(s, decision.statement))) continue;
    const saved = await deps.store.create({
      title: decision.title,
      statement: decision.statement,
      rationale: decision.rationale,
      status: 'candidate',
      origin: 'harvest',
      ownerAccountId: item.authorAccountId,
      deciders: item.authorAccountId ? [item.authorAccountId] : [],
      decidedAt: decision.decidedAt ?? item.createdAt?.slice(0, 10),
      linkedIssueKey: item.linkedIssueKey,
      tags: decision.tags,
      sources: [
        { kind: item.kind, ref: item.ref, url: item.url, title: item.title, excerpt: excerptFor(item.text, decision.statement) },
      ],
      assumptions: toNewAssumptions(decision, item.projectKey),
    });
    statements.push(saved.statement);
    created.push(saved.key);
  }
  return { created, skipped: extracted.length === 0 ? 'No agreed decisions found.' : undefined };
}
