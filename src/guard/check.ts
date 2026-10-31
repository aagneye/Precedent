import { completeJson, type LlmPort } from '../ai/llm';
import { parseEach } from '../ai/json';
import {
  buildJudgePrompt,
  buildTagsPrompt,
  JUDGE_SYSTEM,
  JudgeEnvelopeSchema,
  JudgeFindingSchema,
  TAGS_SYSTEM,
  TagsSchema,
  type JudgeFinding,
} from '../ai/prompts';
import { decisionHealth } from '../domain/health';
import type { DecisionStore } from '../domain/store';
import { extractTags, keywords, normalizeTags } from '../domain/tags';
import { BINDING_STATUSES, type CheckChannel, type Decision, type Health, type Verdict } from '../domain/types';
import { isStrongMatch, rankDecisions, type RankedDecision } from './rank';

export interface Finding {
  key: string;
  title: string;
  statement: string;
  rationale: string;
  verdict: Exclude<Verdict, 'irrelevant'>;
  reason: string;
  suggestion?: string;
  status: Decision['status'];
  health: Health;
  ownerAccountId?: string;
  sources: Decision['sources'];
}

export interface GuardResult {
  findings: Finding[];
  conflicts: number;
  /** False when the AI was off, over budget or failed, so findings come from tag matching only. */
  aiChecked: boolean;
  note?: string;
}

export interface GuardDeps {
  store: DecisionStore;
  /** Undefined when AI is switched off for the guard. */
  llm?: LlmPort;
}

export interface CheckOptions {
  channel: CheckChannel;
  actor?: string;
  limit?: number;
}

const CANDIDATE_POOL = 40;

async function findRanked(subject: string, deps: GuardDeps, extraTags: string[] = []): Promise<RankedDecision[]> {
  const vocabulary = await deps.store.allTags();
  const tags = normalizeTags([...extractTags(subject, vocabulary), ...extraTags], 20);
  const words = keywords(subject, 16);
  if (tags.length === 0 && words.length === 0) return [];
  const pool = await deps.store.findCandidates({ tags, keywords: words, statuses: BINDING_STATUSES, limit: CANDIDATE_POOL });
  return rankDecisions({ tags, keywords: words }, pool);
}

function toFinding(decision: Decision, verdict: Finding['verdict'], reason: string, suggestion?: string): Finding {
  return {
    key: decision.key,
    title: decision.title,
    statement: decision.statement,
    rationale: decision.rationale,
    verdict,
    reason,
    suggestion,
    status: decision.status,
    health: decisionHealth(decision),
    ownerAccountId: decision.ownerAccountId,
    sources: decision.sources,
  };
}

function fallbackFindings(ranked: RankedDecision[]): Finding[] {
  return ranked.filter(isStrongMatch).map((r) => {
    const matched = [...r.matchedTags, ...r.matchedKeywords].slice(0, 4).join(', ');
    return toFinding(r.decision, 'relevant', `Shares scope with this work (${matched}).`);
  });
}

async function judge(subject: string, ranked: RankedDecision[], llm: LlmPort): Promise<Finding[] | undefined> {
  const byKey = new Map(ranked.map((r) => [r.decision.key, r.decision]));
  const prompt = buildJudgePrompt(
    subject,
    ranked.map(({ decision }) => ({
      key: decision.key,
      status: decision.status,
      title: decision.title,
      statement: decision.statement,
      rationale: decision.rationale,
      assumptions: decision.assumptions.map((a) => a.text),
    })),
  );
  const reply = await completeJson(llm, { tier: 'smart', system: JUDGE_SYSTEM, prompt, maxTokens: 1500 }, JudgeEnvelopeSchema);
  if (!reply.ok) return undefined;
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const item of parseEach<JudgeFinding>(reply.value.findings, JudgeFindingSchema)) {
    const decision = byKey.get(item.key.toUpperCase());
    // Only accept keys we sent: the model must not cite decisions that aren't in the candidate set.
    if (!decision || seen.has(decision.key) || item.verdict === 'irrelevant') continue;
    seen.add(decision.key);
    findings.push(toFinding(decision, item.verdict, item.reason || 'Constrains this work.', item.suggestion));
  }
  return findings;
}

async function aiTags(subject: string, llm: LlmPort): Promise<string[]> {
  const reply = await completeJson(llm, { tier: 'fast', system: TAGS_SYSTEM, prompt: buildTagsPrompt(subject), maxTokens: 200 }, TagsSchema);
  return reply.ok ? reply.value.tags : [];
}

/** Checks proposed work (an issue, a plan, a diff summary) against the team's binding decisions. */
export async function checkWork(subject: string, deps: GuardDeps, options: CheckOptions): Promise<GuardResult> {
  let ranked = await findRanked(subject, deps);
  let aiChecked = false;
  let note: string | undefined;
  let findings: Finding[];

  if (!deps.llm) {
    findings = fallbackFindings(ranked);
    note = 'AI checking is off, so these matches come from shared tags and words.';
  } else {
    try {
      if (ranked.length === 0) ranked = await findRanked(subject, deps, await aiTags(subject, deps.llm));
      const judged = ranked.length ? await judge(subject, ranked, deps.llm) : [];
      if (judged) {
        findings = judged;
        aiChecked = true;
      } else {
        findings = fallbackFindings(ranked);
        note = "The AI reply couldn't be read, so these matches come from shared tags and words.";
      }
    } catch (error) {
      findings = fallbackFindings(ranked);
      note = `AI check unavailable (${(error as Error).message}), so these matches come from shared tags and words.`;
    }
  }

  findings.sort((a, b) => Number(b.verdict === 'conflict') - Number(a.verdict === 'conflict'));
  if (options.limit) findings = findings.slice(0, options.limit);
  const conflicts = findings.filter((f) => f.verdict === 'conflict').length;

  await deps.store.logCheck({
    channel: options.channel,
    actor: options.actor,
    subject: subject.slice(0, 500),
    conflicts,
    decisionKeys: findings.map((f) => f.key),
  });

  return { findings, conflicts, aiChecked, note };
}
