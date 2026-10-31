import { kvs } from '@forge/kvs';

export interface DemoState {
  projectKey: string;
  spaceId?: string;
  issueKeys: string[];
  pageIds: string[];
  loadedAt: string;
  status?: 'loading' | 'ready' | 'failed';
  error?: string;
}

export interface Settings {
  /** Confluence spaces whose pages are scanned for decisions. */
  confluenceSpaceIds: string[];
  /** Jira projects whose comments are scanned for decisions. */
  jiraProjectKeys: string[];
  /** Where "Decision review" work items are created. Falls back to the first scanned project. */
  reviewProjectKey?: string;
  ai: {
    /** Use AI to extract decisions from pages and comments. */
    harvest: boolean;
    /** Use AI to judge conflicts; otherwise the guard matches by tags and words only. */
    guard: boolean;
  };
  /** Monthly AI token cap. 0 means no cap. */
  monthlyTokenBudget: number;
  /** The admin who last saved settings; scheduled sweeps look people up on their behalf. */
  adminAccountId?: string;
  demo?: DemoState;
}

export const DEFAULT_SETTINGS: Settings = {
  confluenceSpaceIds: [],
  jiraProjectKeys: [],
  ai: { harvest: true, guard: true },
  monthlyTokenBudget: 2_000_000,
};

const KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const stored = (await kvs.get<Partial<Settings>>(KEY)) ?? {};
  return { ...DEFAULT_SETTINGS, ...stored, ai: { ...DEFAULT_SETTINGS.ai, ...stored.ai } };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = { ...current, ...patch, ai: { ...current.ai, ...patch.ai } };
  await kvs.set(KEY, next);
  return next;
}

const PROJECT_KEY = /^[A-Z][A-Z0-9_]{0,19}$/;

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, 50) : undefined;
}

/** The editable part of settings from an untrusted payload. Unknown or malformed fields are dropped. */
export function sanitizeSettings(input: unknown): Partial<Settings> {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const patch: Partial<Settings> = {};
  const spaces = stringList(raw.confluenceSpaceIds);
  if (spaces) patch.confluenceSpaceIds = spaces;
  const projects = stringList(raw.jiraProjectKeys);
  if (projects) patch.jiraProjectKeys = projects.map((key) => key.toUpperCase()).filter((key) => PROJECT_KEY.test(key));
  if (raw.reviewProjectKey === null || raw.reviewProjectKey === '') patch.reviewProjectKey = undefined;
  else if (typeof raw.reviewProjectKey === 'string' && PROJECT_KEY.test(raw.reviewProjectKey.toUpperCase())) {
    patch.reviewProjectKey = raw.reviewProjectKey.toUpperCase();
  }
  if (raw.ai && typeof raw.ai === 'object') {
    const ai = raw.ai as Record<string, unknown>;
    patch.ai = { ...DEFAULT_SETTINGS.ai };
    if (typeof ai.harvest === 'boolean') patch.ai.harvest = ai.harvest;
    if (typeof ai.guard === 'boolean') patch.ai.guard = ai.guard;
  }
  const budget = Number(raw.monthlyTokenBudget);
  if (raw.monthlyTokenBudget !== undefined && Number.isFinite(budget) && budget >= 0) {
    patch.monthlyTokenBudget = Math.floor(budget);
  }
  return patch;
}

/** The project where review work items go: the configured one, else the first scanned project, else the demo project. */
export function reviewProjectFor(settings: Settings): string | undefined {
  return settings.reviewProjectKey || settings.jiraProjectKeys[0] || settings.demo?.projectKey;
}
