import type {
  AssumptionState,
  CheckLogEntry,
  Decision,
  DecisionPatch,
  DecisionStatus,
  NewAssumption,
  NewDecision,
  NewTripwireEvent,
  SourceKind,
  TripwireEvent,
} from './types';

export interface DecisionQuery {
  statuses?: DecisionStatus[];
  text?: string;
  ids?: number[];
  limit?: number;
  offset?: number;
}

export interface CandidateQuery {
  tags: string[];
  keywords: string[];
  statuses: DecisionStatus[];
  limit: number;
}

export interface CheckLogRow extends CheckLogEntry {
  id: number;
  createdAt: string;
}

/** Persistence port for decisions. Forge SQL implements it in production; tests use an in-memory fake. */
export interface DecisionStore {
  create(input: NewDecision): Promise<Decision>;
  get(id: number): Promise<Decision | undefined>;
  getByKey(key: string): Promise<Decision | undefined>;
  list(query?: DecisionQuery): Promise<Decision[]>;
  /** Binding decisions whose tags or title/statement words overlap the query. */
  findCandidates(query: CandidateQuery): Promise<Decision[]>;
  update(id: number, patch: DecisionPatch): Promise<Decision | undefined>;
  setStatus(id: number, status: DecisionStatus, supersededBy?: string): Promise<void>;
  addAssumption(decisionId: number, assumption: NewAssumption): Promise<void>;
  setAssumptionState(id: number, state: AssumptionState, evidence: string, checkedAt: string): Promise<void>;
  allTags(): Promise<string[]>;
  sourceExists(kind: SourceKind, ref: string): Promise<boolean>;
  addTripwireEvent(event: NewTripwireEvent): Promise<TripwireEvent>;
  listTripwireEvents(decisionId?: number, limit?: number): Promise<TripwireEvent[]>;
  logCheck(entry: CheckLogEntry): Promise<void>;
  listChecks(limit?: number): Promise<CheckLogRow[]>;
  /** Removes every decision with the given origin (used to reset the demo company). */
  deleteByOrigin(origin: Decision['origin']): Promise<number>;
}
