import { z } from 'zod';
import type { Watch } from '../domain/types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Leniently parsed watch: anything malformed becomes a manual (unchecked) assumption. */
const WatchSchema: z.ZodType<Watch> = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('date'),
      expiresOn: z.string().regex(ISO_DATE),
      warnDays: z.number().int().min(0).max(365).optional(),
    }),
    z.object({
      type: z.literal('jql'),
      jql: z.string().min(3).max(500),
      operator: z.enum(['gt', 'gte', 'lt', 'lte']),
      threshold: z.number(),
    }),
    z.object({ type: z.literal('goal'), goal: z.string().min(2).max(200) }),
    z.object({ type: z.literal('manual') }),
  ])
  .catch({ type: 'manual' });

export const ExtractedDecisionSchema = z.object({
  title: z.string().min(3).max(120),
  statement: z.string().min(5).max(600),
  rationale: z.string().max(1200).catch(''),
  decidedAt: z.string().regex(ISO_DATE).optional().catch(undefined),
  tags: z.array(z.string().max(60)).max(12).catch([]),
  assumptions: z
    .array(z.object({ text: z.string().min(3).max(400), watch: WatchSchema }))
    .max(6)
    .catch([]),
  confidence: z.number().min(0).max(1).catch(0.5),
});
export type ExtractedDecision = z.infer<typeof ExtractedDecisionSchema>;

/** The envelope only; items are validated one by one with `parseEach`. */
export const ExtractionEnvelopeSchema = z.object({ decisions: z.array(z.unknown()).max(10) });

export const EXTRACT_SYSTEM =
  'You extract team decisions from workplace text for Precedent, a decision register. ' +
  'A decision is a choice the team agreed on that should constrain future work: technology, architecture, ' +
  'policy, process, vendor or scope. Ignore proposals nobody agreed to, open questions and status updates. ' +
  'Reply with JSON only.';

export interface ExtractSource {
  kindLabel: string;
  title: string;
  author?: string;
  createdAt?: string;
  projectKey?: string;
  text: string;
}

const MAX_SOURCE_CHARS = 12_000;

export function buildExtractPrompt(source: ExtractSource, today: string): string {
  const project = source.projectKey
    ? `Jira project key for JQL: ${source.projectKey}.`
    : 'If you need a Jira project key in JQL, use PROJECT.';
  return `Today is ${today}. Source: ${source.kindLabel} "${source.title}"${source.author ? ` by ${source.author}` : ''}${
    source.createdAt ? ` on ${source.createdAt}` : ''
  }. ${project}

Extract every decision the team actually made. For each one return:
- title: a short name, at most 10 words
- statement: the rule future work must follow, written as "We ..." (at most 2 sentences)
- rationale: why, taken from the text (at most 3 sentences; "" if not stated)
- decidedAt: YYYY-MM-DD if the text says when; otherwise omit it
- tags: 2-8 lowercase scope tags such as services, technologies, vendors or policies (e.g. "ledger-service", "postgresql")
- assumptions: the conditions the decision depends on, each with a watch that says when it BREAKS:
  - {"type":"date","expiresOn":"YYYY-MM-DD"} for time limits, such as a contract end or "until Q2 2027"
  - {"type":"jql","jql":"project = KEY AND labels = incident AND created >= -30d","operator":"gt","threshold":2} when it depends on how many Jira work items match a query
  - {"type":"goal","goal":"<goal name>"} when it depends on a company goal staying on track
  - {"type":"manual"} for anything else
- confidence: 0 to 1, how sure you are this is a real, agreed decision

Reply with {"decisions":[...]} and nothing else. If there are none, reply {"decisions":[]}.

Text:
"""
${source.text.slice(0, MAX_SOURCE_CHARS)}
"""`;
}

export const JudgeFindingSchema = z.object({
  key: z.string(),
  verdict: z.enum(['conflict', 'relevant', 'irrelevant']),
  reason: z.string().max(400).catch(''),
  suggestion: z.string().max(400).optional().catch(undefined),
});
export type JudgeFinding = z.infer<typeof JudgeFindingSchema>;

export const JudgeEnvelopeSchema = z.object({ findings: z.array(z.unknown()) });

export const JUDGE_SYSTEM =
  "You are Precedent's guard. You check proposed work against a team's binding decisions. " +
  "A conflict means the work would violate or reverse a decision's statement. Relevant means the decision " +
  'constrains how the work should be done. Anything else is irrelevant. Be precise and never invent decisions. ' +
  'Reply with JSON only.';

export interface JudgeCandidate {
  key: string;
  status: string;
  title: string;
  statement: string;
  rationale: string;
  assumptions: string[];
}

export function buildJudgePrompt(subject: string, candidates: JudgeCandidate[]): string {
  const list = candidates
    .map((c) => {
      const assumptions = c.assumptions.length ? ` Assumptions: ${c.assumptions.join('; ')}.` : '';
      return `${c.key} [${c.status}] ${c.title}. Statement: ${c.statement} Rationale: ${c.rationale || 'not recorded'}.${assumptions}`;
    })
    .join('\n');
  return `Proposed work:
"""
${subject.slice(0, 6_000)}
"""

Binding decisions:
${list}

For each decision listed above, return {"key":"DEC-n","verdict":"conflict|relevant|irrelevant","reason":"one sentence that cites the decision","suggestion":"how to do the work while respecting the decision (optional)"}.
Reply with {"findings":[...]} containing exactly one entry per decision listed.`;
}

export const TagsSchema = z.object({ tags: z.array(z.string().max(60)).max(10).catch([]) });

export const TAGS_SYSTEM =
  'You label work items with scope tags: services, technologies, vendors and policies. Reply with JSON only.';

export function buildTagsPrompt(text: string): string {
  return `List up to 8 lowercase scope tags for this text, e.g. "postgresql", "ledger-service", "card-data".
Reply with {"tags":[...]}.

Text:
"""
${text.slice(0, 4_000)}
"""`;
}
