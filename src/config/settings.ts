import { kvs } from '@forge/kvs';

export interface DemoState {
  projectKey: string;
  spaceId?: string;
  issueKeys: string[];
  pageIds: string[];
  loadedAt: string;
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

/** The project where review work items go: the configured one, else the first scanned project, else the demo project. */
export function reviewProjectFor(settings: Settings): string | undefined {
  return settings.reviewProjectKey || settings.jiraProjectKeys[0] || settings.demo?.projectKey;
}
