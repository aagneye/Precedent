import { sql, type UpdateQueryResponse } from '@forge/sql';
import { formatDecisionKey } from '../domain/keys';
import type { CandidateQuery, CheckLogRow, DecisionQuery, DecisionStore } from '../domain/store';
import { normalizeTags } from '../domain/tags';
import {
  BINDING_STATUSES,
  type Assumption,
  type AssumptionState,
  type CheckLogEntry,
  type Decision,
  type DecisionPatch,
  type DecisionSource,
  type DecisionStatus,
  type NewAssumption,
  type NewDecision,
  type NewTripwireEvent,
  type SourceKind,
  type TripwireEvent,
  type Watch,
} from '../domain/types';
import { ensureSchema } from './schema';

type Id = number | string;

interface DecisionRow {
  id: Id;
  seq: Id;
  dkey: string;
  title: string;
  statement: string;
  rationale: string;
  status: string;
  origin: string;
  origin_label: string | null;
  owner_account_id: string | null;
  deciders: string | null;
  decided_at: string | null;
  linked_issue_key: string | null;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
}

interface TagRow {
  decision_id: Id;
  tag: string;
}

interface SourceRow {
  decision_id: Id;
  kind: string;
  ref: string;
  url: string | null;
  title: string | null;
  excerpt: string | null;
}

interface AssumptionRow {
  id: Id;
  decision_id: Id;
  text: string;
  watch: string;
  state: string;
  last_checked_at: string | null;
  evidence: string | null;
}

interface EventRow {
  id: Id;
  decision_id: Id;
  assumption_id: Id | null;
  from_state: string | null;
  to_state: string;
  evidence: string;
  review_issue_key: string | null;
  successor_account_id: string | null;
  created_at: string;
}

interface CheckRow {
  id: Id;
  channel: string;
  actor: string | null;
  subject: string;
  conflicts: Id;
  decision_keys: string;
  created_at: string;
}

const DECISION_COLUMNS =
  'id, seq, dkey, title, statement, rationale, status, origin, origin_label, owner_account_id, deciders, ' +
  'decided_at, linked_issue_key, superseded_by, created_at, updated_at';

const MAX_EXCERPT = 2_000;

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

function nowIso(): string {
  return new Date().toISOString();
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function parseJson<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function orNull<T>(value: T | undefined): T | null {
  return value === undefined || value === '' ? null : value;
}

async function select<T>(query: string, ...params: unknown[]): Promise<T[]> {
  const result = await sql.prepare<T>(query).bindParams(...params).execute();
  return result.rows as T[];
}

async function execute(query: string, ...params: unknown[]): Promise<UpdateQueryResponse> {
  const result = await sql.prepare<UpdateQueryResponse>(query).bindParams(...params).execute();
  return result.rows as UpdateQueryResponse;
}

function groupBy<T extends { decision_id: Id }>(items: T[]): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const id = Number(item.decision_id);
    const group = groups.get(id);
    if (group) group.push(item);
    else groups.set(id, [item]);
  }
  return groups;
}

function toAssumption(row: AssumptionRow): Assumption {
  return {
    id: Number(row.id),
    decisionId: Number(row.decision_id),
    text: row.text,
    watch: parseJson<Watch>(row.watch, { type: 'manual' }),
    state: row.state as AssumptionState,
    lastCheckedAt: row.last_checked_at ?? undefined,
    evidence: row.evidence ?? undefined,
  };
}

function toSource(row: SourceRow): DecisionSource {
  return {
    kind: row.kind as SourceKind,
    ref: row.ref,
    url: row.url ?? undefined,
    title: row.title ?? undefined,
    excerpt: row.excerpt ?? undefined,
  };
}

function toEvent(row: EventRow): TripwireEvent {
  return {
    id: Number(row.id),
    decisionId: Number(row.decision_id),
    assumptionId: row.assumption_id === null ? undefined : Number(row.assumption_id),
    fromState: (row.from_state as AssumptionState | null) ?? undefined,
    toState: row.to_state as AssumptionState,
    evidence: row.evidence,
    reviewIssueKey: row.review_issue_key ?? undefined,
    successorAccountId: row.successor_account_id ?? undefined,
    createdAt: row.created_at,
  };
}

/** DecisionStore backed by Forge SQL. Every method applies pending migrations first. */
export class SqlDecisionStore implements DecisionStore {
  private async hydrate(rows: DecisionRow[]): Promise<Decision[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => Number(row.id));
    const inIds = placeholders(ids.length);
    const [tags, sources, assumptions] = await Promise.all([
      select<TagRow>(`SELECT decision_id, tag FROM decision_tags WHERE decision_id IN (${inIds})`, ...ids),
      select<SourceRow>(
        `SELECT decision_id, kind, ref, url, title, excerpt FROM decision_sources WHERE decision_id IN (${inIds}) ORDER BY id`,
        ...ids,
      ),
      select<AssumptionRow>(
        `SELECT id, decision_id, text, watch, state, last_checked_at, evidence FROM assumptions WHERE decision_id IN (${inIds}) ORDER BY id`,
        ...ids,
      ),
    ]);
    const tagsById = groupBy(tags);
    const sourcesById = groupBy(sources);
    const assumptionsById = groupBy(assumptions);
    return rows.map((row) => {
      const id = Number(row.id);
      return {
        id,
        key: row.dkey,
        title: row.title,
        statement: row.statement,
        rationale: row.rationale,
        status: row.status as DecisionStatus,
        origin: row.origin as Decision['origin'],
        originLabel: row.origin_label ?? undefined,
        ownerAccountId: row.owner_account_id ?? undefined,
        deciders: parseJson<string[]>(row.deciders, []),
        decidedAt: row.decided_at ?? undefined,
        linkedIssueKey: row.linked_issue_key ?? undefined,
        supersededBy: row.superseded_by ?? undefined,
        tags: (tagsById.get(id) ?? []).map((t) => t.tag).sort(),
        sources: (sourcesById.get(id) ?? []).map(toSource),
        assumptions: (assumptionsById.get(id) ?? []).map(toAssumption),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  private async writeTags(decisionId: number, rawTags: string[]): Promise<void> {
    const tags = normalizeTags(rawTags).map((tag) => tag.slice(0, 64));
    if (tags.length === 0) return;
    await execute(
      `INSERT IGNORE INTO decision_tags (decision_id, tag) VALUES ${tags.map(() => '(?, ?)').join(', ')}`,
      ...tags.flatMap((tag) => [decisionId, tag]),
    );
  }

  private async writeSources(decisionId: number, sources: DecisionSource[]): Promise<void> {
    if (sources.length === 0) return;
    await execute(
      `INSERT INTO decision_sources (decision_id, kind, ref, url, title, excerpt) VALUES ${sources
        .map(() => '(?, ?, ?, ?, ?, ?)')
        .join(', ')}`,
      ...sources.flatMap((s) => [
        decisionId,
        s.kind,
        s.ref.slice(0, 255),
        orNull(s.url),
        orNull(s.title?.slice(0, 255)),
        orNull(s.excerpt?.slice(0, MAX_EXCERPT)),
      ]),
    );
  }

  async create(input: NewDecision): Promise<Decision> {
    await ensureSchema();
    const now = nowIso();
    for (let attempt = 0; ; attempt += 1) {
      const [{ next }] = await select<{ next: Id }>('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM decisions');
      const seq = Number(next);
      try {
        const inserted = await execute(
          `INSERT INTO decisions (seq, dkey, title, statement, rationale, status, origin, origin_label, owner_account_id,
            deciders, decided_at, linked_issue_key, created_at, updated_at) VALUES (${placeholders(14)})`,
          seq,
          formatDecisionKey(seq),
          input.title.slice(0, 255),
          input.statement,
          input.rationale,
          input.status,
          input.origin,
          orNull(input.originLabel?.slice(0, 255)),
          orNull(input.ownerAccountId),
          JSON.stringify(input.deciders ?? []),
          orNull(input.decidedAt),
          orNull(input.linkedIssueKey),
          now,
          now,
        );
        const id = Number(inserted.insertId);
        await this.writeTags(id, input.tags);
        await this.writeSources(id, input.sources);
        for (const assumption of input.assumptions) await this.addAssumption(id, assumption);
        const created = await this.get(id);
        if (!created) throw new Error(`Decision ${id} vanished after insert`);
        return created;
      } catch (error) {
        // Two writers can race for the same sequence number; the unique key rejects one, which retries.
        if (attempt < 3 && /duplicate/i.test((error as Error).message)) continue;
        throw error;
      }
    }
  }

  async get(id: number): Promise<Decision | undefined> {
    const [decision] = await this.list({ ids: [id] });
    return decision;
  }

  async getByKey(key: string): Promise<Decision | undefined> {
    await ensureSchema();
    const rows = await select<DecisionRow>(`SELECT ${DECISION_COLUMNS} FROM decisions WHERE dkey = ?`, key.trim().toUpperCase());
    const [decision] = await this.hydrate(rows);
    return decision;
  }

  async list(query: DecisionQuery = {}): Promise<Decision[]> {
    await ensureSchema();
    const where: string[] = [];
    const params: unknown[] = [];
    if (query.statuses?.length) {
      where.push(`status IN (${placeholders(query.statuses.length)})`);
      params.push(...query.statuses);
    }
    if (query.ids) {
      if (query.ids.length === 0) return [];
      where.push(`id IN (${placeholders(query.ids.length)})`);
      params.push(...query.ids);
    }
    const text = query.text?.trim();
    if (text) {
      const like = `%${escapeLike(text.toLowerCase())}%`;
      where.push('(LOWER(title) LIKE ? OR LOWER(statement) LIKE ? OR dkey = ?)');
      params.push(like, like, text.toUpperCase());
    }
    const limit = clampInt(query.limit ?? 200, 1, 500);
    const offset = clampInt(query.offset ?? 0, 0, 100_000);
    const rows = await select<DecisionRow>(
      `SELECT ${DECISION_COLUMNS} FROM decisions ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY seq DESC LIMIT ${limit} OFFSET ${offset}`,
      ...params,
    );
    return this.hydrate(rows);
  }

  async findCandidates(query: CandidateQuery): Promise<Decision[]> {
    await ensureSchema();
    if (query.statuses.length === 0) return [];
    const conditions: string[] = [];
    const params: unknown[] = [...query.statuses];
    if (query.tags.length) {
      conditions.push(`d.id IN (SELECT decision_id FROM decision_tags WHERE tag IN (${placeholders(query.tags.length)}))`);
      params.push(...query.tags);
    }
    for (const word of query.keywords.slice(0, 16)) {
      const like = `%${escapeLike(word.toLowerCase())}%`;
      conditions.push('LOWER(d.title) LIKE ?', 'LOWER(d.statement) LIKE ?');
      params.push(like, like);
    }
    if (conditions.length === 0) return [];
    const limit = clampInt(query.limit, 1, 200);
    const ids = await select<{ id: Id }>(
      `SELECT d.id FROM decisions d WHERE d.status IN (${placeholders(query.statuses.length)}) AND (${conditions.join(' OR ')})
       ORDER BY d.seq LIMIT ${limit}`,
      ...params,
    );
    return this.list({ ids: ids.map((row) => Number(row.id)), limit });
  }

  async update(id: number, patch: DecisionPatch): Promise<Decision | undefined> {
    await ensureSchema();
    const sets: string[] = [];
    const params: unknown[] = [];
    const set = (column: string, value: unknown): void => {
      sets.push(`${column} = ?`);
      params.push(value);
    };
    if (patch.title !== undefined) set('title', patch.title.slice(0, 255));
    if (patch.statement !== undefined) set('statement', patch.statement);
    if (patch.rationale !== undefined) set('rationale', patch.rationale);
    if (patch.ownerAccountId !== undefined) set('owner_account_id', orNull(patch.ownerAccountId));
    if (patch.decidedAt !== undefined) set('decided_at', orNull(patch.decidedAt));
    if (patch.linkedIssueKey !== undefined) set('linked_issue_key', orNull(patch.linkedIssueKey));
    set('updated_at', nowIso());
    await execute(`UPDATE decisions SET ${sets.join(', ')} WHERE id = ?`, ...params, id);
    if (patch.tags) {
      await execute('DELETE FROM decision_tags WHERE decision_id = ?', id);
      await this.writeTags(id, patch.tags);
    }
    return this.get(id);
  }

  async setStatus(id: number, status: DecisionStatus, supersededBy?: string): Promise<void> {
    await ensureSchema();
    await execute(
      'UPDATE decisions SET status = ?, superseded_by = COALESCE(?, superseded_by), updated_at = ? WHERE id = ?',
      status,
      orNull(supersededBy),
      nowIso(),
      id,
    );
  }

  async addAssumption(decisionId: number, assumption: NewAssumption): Promise<void> {
    await ensureSchema();
    await execute(
      'INSERT INTO assumptions (decision_id, text, watch, state) VALUES (?, ?, ?, ?)',
      decisionId,
      assumption.text,
      JSON.stringify(assumption.watch),
      'unknown',
    );
  }

  async setAssumptionState(id: number, state: AssumptionState, evidence: string, checkedAt: string): Promise<void> {
    await ensureSchema();
    await execute('UPDATE assumptions SET state = ?, evidence = ?, last_checked_at = ? WHERE id = ?', state, evidence, checkedAt, id);
  }

  async allTags(): Promise<string[]> {
    await ensureSchema();
    const rows = await select<{ tag: string }>(
      `SELECT DISTINCT t.tag FROM decision_tags t JOIN decisions d ON d.id = t.decision_id
       WHERE d.status IN (${placeholders(BINDING_STATUSES.length)})`,
      ...BINDING_STATUSES,
    );
    return rows.map((row) => row.tag);
  }

  async sourceExists(kind: SourceKind, ref: string): Promise<boolean> {
    await ensureSchema();
    const rows = await select<{ found: Id }>('SELECT 1 AS found FROM decision_sources WHERE kind = ? AND ref = ? LIMIT 1', kind, ref);
    return rows.length > 0;
  }

  async addTripwireEvent(event: NewTripwireEvent): Promise<TripwireEvent> {
    await ensureSchema();
    const createdAt = nowIso();
    const inserted = await execute(
      `INSERT INTO tripwire_events (decision_id, assumption_id, from_state, to_state, evidence, review_issue_key,
        successor_account_id, created_at) VALUES (${placeholders(8)})`,
      event.decisionId,
      event.assumptionId ?? null,
      event.fromState ?? null,
      event.toState,
      event.evidence,
      orNull(event.reviewIssueKey),
      orNull(event.successorAccountId),
      createdAt,
    );
    return { ...event, id: Number(inserted.insertId), createdAt };
  }

  async listTripwireEvents(decisionId?: number, limit = 50): Promise<TripwireEvent[]> {
    await ensureSchema();
    const cap = clampInt(limit, 1, 500);
    const rows =
      decisionId === undefined
        ? await select<EventRow>(`SELECT * FROM tripwire_events ORDER BY id DESC LIMIT ${cap}`)
        : await select<EventRow>(`SELECT * FROM tripwire_events WHERE decision_id = ? ORDER BY id DESC LIMIT ${cap}`, decisionId);
    return rows.map(toEvent);
  }

  async logCheck(entry: CheckLogEntry): Promise<void> {
    await ensureSchema();
    await execute(
      'INSERT INTO check_log (channel, actor, subject, conflicts, decision_keys, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      entry.channel,
      orNull(entry.actor?.slice(0, 255)),
      entry.subject.slice(0, 512),
      entry.conflicts,
      JSON.stringify(entry.decisionKeys),
      nowIso(),
    );
  }

  async listChecks(limit = 50): Promise<CheckLogRow[]> {
    await ensureSchema();
    const rows = await select<CheckRow>(`SELECT * FROM check_log ORDER BY id DESC LIMIT ${clampInt(limit, 1, 500)}`);
    return rows.map((row) => ({
      id: Number(row.id),
      channel: row.channel as CheckLogRow['channel'],
      actor: row.actor ?? undefined,
      subject: row.subject,
      conflicts: Number(row.conflicts),
      decisionKeys: parseJson<string[]>(row.decision_keys, []),
      createdAt: row.created_at,
    }));
  }

  async deleteByOrigin(origin: Decision['origin']): Promise<number> {
    await ensureSchema();
    const ids = (await select<{ id: Id }>('SELECT id FROM decisions WHERE origin = ?', origin)).map((row) => Number(row.id));
    if (ids.length === 0) return 0;
    const inIds = placeholders(ids.length);
    for (const table of ['decision_tags', 'decision_sources', 'assumptions', 'tripwire_events']) {
      await execute(`DELETE FROM ${table} WHERE decision_id IN (${inIds})`, ...ids);
    }
    await execute(`DELETE FROM decisions WHERE id IN (${inIds})`, ...ids);
    return ids.length;
  }
}
