import { formatDecisionKey, parseDecisionKey } from '../../src/domain/keys';
import type { CandidateQuery, CheckLogRow, DecisionQuery, DecisionStore } from '../../src/domain/store';
import { normalizeTags } from '../../src/domain/tags';
import {
  BINDING_STATUSES,
  type AssumptionState,
  type CheckLogEntry,
  type Decision,
  type DecisionPatch,
  type DecisionStatus,
  type NewAssumption,
  type NewDecision,
  type NewTripwireEvent,
  type SourceKind,
  type TripwireEvent,
} from '../../src/domain/types';

const NOW = '2026-11-01T00:00:00.000Z';

/** In-memory DecisionStore for tests. Returns copies so callers can't mutate stored state. */
export class MemoryStore implements DecisionStore {
  decisions: Decision[] = [];
  events: TripwireEvent[] = [];
  checks: CheckLogRow[] = [];
  private nextId = 1;
  private nextAssumptionId = 1;
  private nextEventId = 1;

  private find(id: number): Decision | undefined {
    return this.decisions.find((d) => d.id === id);
  }

  async create(input: NewDecision): Promise<Decision> {
    const id = this.nextId++;
    const seq = Math.max(0, ...this.decisions.map((d) => parseDecisionKey(d.key) ?? 0)) + 1;
    const decision: Decision = {
      id,
      key: formatDecisionKey(seq),
      title: input.title,
      statement: input.statement,
      rationale: input.rationale,
      status: input.status,
      origin: input.origin,
      originLabel: input.originLabel,
      ownerAccountId: input.ownerAccountId,
      deciders: input.deciders ?? [],
      decidedAt: input.decidedAt,
      linkedIssueKey: input.linkedIssueKey,
      tags: normalizeTags(input.tags).sort(),
      sources: input.sources.map((s) => ({ ...s })),
      assumptions: input.assumptions.map((a) => ({
        id: this.nextAssumptionId++,
        decisionId: id,
        text: a.text,
        watch: a.watch,
        state: 'unknown' as AssumptionState,
      })),
      createdAt: NOW,
      updatedAt: NOW,
    };
    this.decisions.push(decision);
    return structuredClone(decision);
  }

  async get(id: number): Promise<Decision | undefined> {
    const decision = this.find(id);
    return decision && structuredClone(decision);
  }

  async getByKey(key: string): Promise<Decision | undefined> {
    const decision = this.decisions.find((d) => d.key === key.toUpperCase());
    return decision && structuredClone(decision);
  }

  async list(query: DecisionQuery = {}): Promise<Decision[]> {
    const text = query.text?.toLowerCase();
    return this.decisions
      .filter((d) => !query.statuses || query.statuses.includes(d.status))
      .filter((d) => !query.ids || query.ids.includes(d.id))
      .filter((d) => !text || d.title.toLowerCase().includes(text) || d.statement.toLowerCase().includes(text))
      .sort((a, b) => (parseDecisionKey(b.key) ?? 0) - (parseDecisionKey(a.key) ?? 0))
      .slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 200))
      .map((d) => structuredClone(d));
  }

  async findCandidates(query: CandidateQuery): Promise<Decision[]> {
    return this.decisions
      .filter((d) => query.statuses.includes(d.status))
      .filter((d) => {
        const text = `${d.title} ${d.statement}`.toLowerCase();
        return d.tags.some((t) => query.tags.includes(t)) || query.keywords.some((w) => text.includes(w.toLowerCase()));
      })
      .slice(0, query.limit)
      .map((d) => structuredClone(d));
  }

  async update(id: number, patch: DecisionPatch): Promise<Decision | undefined> {
    const decision = this.find(id);
    if (!decision) return undefined;
    Object.assign(decision, { ...patch, tags: patch.tags ? normalizeTags(patch.tags).sort() : decision.tags });
    return structuredClone(decision);
  }

  async setStatus(id: number, status: DecisionStatus, supersededBy?: string): Promise<void> {
    const decision = this.find(id);
    if (!decision) return;
    decision.status = status;
    if (supersededBy) decision.supersededBy = supersededBy;
  }

  async addAssumption(decisionId: number, assumption: NewAssumption): Promise<void> {
    this.find(decisionId)?.assumptions.push({
      id: this.nextAssumptionId++,
      decisionId,
      text: assumption.text,
      watch: assumption.watch,
      state: 'unknown',
    });
  }

  async setAssumptionState(id: number, state: AssumptionState, evidence: string, checkedAt: string): Promise<void> {
    for (const decision of this.decisions) {
      const assumption = decision.assumptions.find((a) => a.id === id);
      if (assumption) Object.assign(assumption, { state, evidence, lastCheckedAt: checkedAt });
    }
  }

  async allTags(): Promise<string[]> {
    return [...new Set(this.decisions.filter((d) => BINDING_STATUSES.includes(d.status)).flatMap((d) => d.tags))];
  }

  async sourceExists(kind: SourceKind, ref: string): Promise<boolean> {
    return this.decisions.some((d) => d.sources.some((s) => s.kind === kind && s.ref === ref));
  }

  async addTripwireEvent(event: NewTripwireEvent): Promise<TripwireEvent> {
    const saved = { ...event, id: this.nextEventId++, createdAt: NOW };
    this.events.push(saved);
    return { ...saved };
  }

  async listTripwireEvents(decisionId?: number, limit = 50): Promise<TripwireEvent[]> {
    return this.events
      .filter((e) => decisionId === undefined || e.decisionId === decisionId)
      .slice(-limit)
      .reverse();
  }

  async logCheck(entry: CheckLogEntry): Promise<void> {
    this.checks.push({ ...entry, id: this.checks.length + 1, createdAt: NOW });
  }

  async listChecks(limit = 50): Promise<CheckLogRow[]> {
    return this.checks.slice(-limit).reverse();
  }

  async deleteByOrigin(origin: Decision['origin']): Promise<number> {
    const before = this.decisions.length;
    this.decisions = this.decisions.filter((d) => d.origin !== origin);
    return before - this.decisions.length;
  }
}
