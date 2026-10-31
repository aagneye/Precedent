import { healthCounts } from '../domain/health';
import type { CheckLogRow } from '../domain/store';
import type { Decision, Health, TripwireEvent } from '../domain/types';
import { toDecisionView, toEventView, type DecisionView, type EventView } from './decisionView';

export interface MonthGroup {
  month: string;
  label: string;
  decisions: DecisionView[];
}

export interface TeamGroup {
  team: string;
  decisionKeys: string[];
}

export interface MapView {
  counts: Record<Health, number>;
  total: number;
  months: MonthGroup[];
  events: EventView[];
  checks: CheckLogRow[];
  topTags: Array<{ tag: string; count: number }>;
  teams: TeamGroup[];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthLabel(month: string): string {
  const [year, index] = month.split('-').map(Number);
  return MONTHS[index - 1] ? `${MONTHS[index - 1]} ${year}` : 'Undated';
}

/** Decisions grouped by the month they were made, newest month first; undated ones last. */
export function groupByMonth(decisions: Decision[]): MonthGroup[] {
  const groups = new Map<string, Decision[]>();
  for (const decision of decisions) {
    const month = decision.decidedAt?.slice(0, 7) ?? decision.createdAt.slice(0, 7);
    groups.set(month, [...(groups.get(month) ?? []), decision]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, items]) => ({
      month,
      label: monthLabel(month),
      decisions: items
        .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? '') || b.id - a.id)
        .map(toDecisionView),
    }));
}

export function topTags(decisions: Decision[], limit = 12): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const decision of decisions) for (const tag of decision.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

/** Groups decision keys by their owner's team; owners without a known team are left out. */
export function groupByTeam(decisions: Decision[], teamOfOwner: Map<string, string>): TeamGroup[] {
  const groups = new Map<string, string[]>();
  for (const decision of decisions) {
    const team = decision.ownerAccountId ? teamOfOwner.get(decision.ownerAccountId) : undefined;
    if (team) groups.set(team, [...(groups.get(team) ?? []), decision.key]);
  }
  return [...groups.entries()].map(([team, decisionKeys]) => ({ team, decisionKeys })).sort((a, b) => a.team.localeCompare(b.team));
}

export function buildMap(
  decisions: Decision[],
  events: TripwireEvent[],
  checks: CheckLogRow[],
  teamOfOwner: Map<string, string> = new Map(),
): MapView {
  const binding = decisions.filter((d) => d.status === 'ratified' || d.status === 'under_review');
  const byId = new Map(decisions.map((d) => [d.id, d]));
  return {
    counts: healthCounts(binding),
    total: binding.length,
    months: groupByMonth(decisions),
    events: events.map((e) => toEventView(e, byId.get(e.decisionId))),
    checks,
    topTags: topTags(binding),
    teams: groupByTeam(binding, teamOfOwner),
  };
}
