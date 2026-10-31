import api, { route, type APIResponse } from '@forge/api';
import { adfToText, type AdfDoc } from './adf';

export interface IssueSummary {
  id: string;
  key: string;
  summary: string;
  description: string;
  projectKey: string;
  labels: string[];
  components: string[];
  status?: string;
}

export interface IssueComment {
  id: string;
  text: string;
  authorAccountId?: string;
  created?: string;
}

export interface ProjectSummary {
  key: string;
  name: string;
}

async function json<T>(response: APIResponse, what: string): Promise<T> {
  if (!response.ok) throw new Error(`${what} failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return (await response.json()) as T;
}

let baseUrl: string | undefined;

/** The site's base URL, e.g. https://acme.atlassian.net. */
export async function siteBaseUrl(): Promise<string> {
  if (!baseUrl) {
    const info = await json<{ baseUrl: string }>(
      await api.asApp().requestJira(route`/rest/api/3/serverInfo`),
      'Reading server info',
    );
    baseUrl = info.baseUrl.replace(/\/$/, '');
  }
  return baseUrl;
}

export async function issueUrl(key: string): Promise<string> {
  return `${await siteBaseUrl()}/browse/${key}`;
}

interface IssueFields {
  summary?: string;
  description?: unknown;
  labels?: string[];
  components?: Array<{ name: string }>;
  project?: { key: string };
  status?: { name: string };
}

export async function getIssue(key: string): Promise<IssueSummary | undefined> {
  const response = await api
    .asApp()
    .requestJira(route`/rest/api/3/issue/${key}?fields=summary,description,labels,components,project,status`);
  if (response.status === 404) return undefined;
  const issue = await json<{ id: string; key: string; fields: IssueFields }>(response, `Reading ${key}`);
  return {
    id: issue.id,
    key: issue.key,
    summary: issue.fields.summary ?? '',
    description: adfToText(issue.fields.description).trim(),
    projectKey: issue.fields.project?.key ?? key.split('-')[0],
    labels: issue.fields.labels ?? [],
    components: (issue.fields.components ?? []).map((c) => c.name),
    status: issue.fields.status?.name,
  };
}

/** How many issues match a JQL query, or undefined if the query can't run. */
export async function countJql(jql: string): Promise<number | undefined> {
  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/search/approximate-count`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ jql }),
    });
    if (response.ok) return ((await response.json()) as { count: number }).count;
    const page = await json<{ issues: unknown[] }>(
      await api.asApp().requestJira(route`/rest/api/3/search/jql?jql=${jql}&maxResults=100&fields=id`),
      'Counting issues',
    );
    return page.issues.length;
  } catch {
    return undefined;
  }
}

/** True if the account is active, false if deactivated or deleted, undefined if the lookup failed. */
export async function isUserActive(accountId: string): Promise<boolean | undefined> {
  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/user?accountId=${accountId}`);
    if (response.status === 404) return false;
    const user = await json<{ active: boolean }>(response, 'Reading user');
    return user.active;
  } catch {
    return undefined;
  }
}

export async function displayName(accountId: string): Promise<string | undefined> {
  const response = await api.asApp().requestJira(route`/rest/api/3/user?accountId=${accountId}`);
  if (!response.ok) return undefined;
  return ((await response.json()) as { displayName?: string }).displayName;
}

async function issueTypeId(projectKey: string, preferred: string[]): Promise<string> {
  const meta = await json<{ issueTypes?: Array<{ id: string; name: string; subtask: boolean }>; values?: Array<{ id: string; name: string; subtask: boolean }> }>(
    await api.asApp().requestJira(route`/rest/api/3/issue/createmeta/${projectKey}/issuetypes`),
    `Reading issue types for ${projectKey}`,
  );
  const types = (meta.issueTypes ?? meta.values ?? []).filter((t) => !t.subtask);
  for (const name of preferred) {
    const match = types.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (match) return match.id;
  }
  if (!types[0]) throw new Error(`Project ${projectKey} has no issue types the app can create`);
  return types[0].id;
}

export interface NewIssue {
  projectKey: string;
  summary: string;
  description?: AdfDoc;
  labels?: string[];
  assigneeAccountId?: string;
  issueTypes?: string[];
}

/** Creates an issue and returns its key. If the assignee can't be assigned, creates it unassigned. */
export async function createIssue(input: NewIssue): Promise<string> {
  const fields: Record<string, unknown> = {
    project: { key: input.projectKey },
    summary: input.summary.slice(0, 250),
    issuetype: { id: await issueTypeId(input.projectKey, input.issueTypes ?? ['Task', 'Story']) },
    labels: input.labels ?? [],
  };
  if (input.description) fields.description = input.description;
  const post = (body: Record<string, unknown>) =>
    api.asApp().requestJira(route`/rest/api/3/issue`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: body }),
    });
  let response = await post(input.assigneeAccountId ? { ...fields, assignee: { accountId: input.assigneeAccountId } } : fields);
  if (!response.ok && input.assigneeAccountId) response = await post(fields);
  return (await json<{ key: string }>(response, 'Creating issue')).key;
}

export async function addComment(issueKey: string, body: AdfDoc): Promise<string> {
  const comment = await json<{ id: string }>(
    await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }),
    `Commenting on ${issueKey}`,
  );
  return comment.id;
}

interface RawComment {
  id: string;
  body?: unknown;
  author?: { accountId?: string };
  created?: string;
}

function toComment(raw: RawComment): IssueComment {
  return { id: raw.id, text: adfToText(raw.body).trim(), authorAccountId: raw.author?.accountId, created: raw.created };
}

export async function getComment(issueKey: string, commentId: string): Promise<IssueComment | undefined> {
  const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/comment/${commentId}`);
  if (response.status === 404) return undefined;
  return toComment(await json<RawComment>(response, `Reading comment ${commentId}`));
}

export async function getComments(issueKey: string, max = 50): Promise<IssueComment[]> {
  const page = await json<{ comments: RawComment[] }>(
    await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/comment?maxResults=${String(max)}&orderBy=-created`),
    `Reading comments on ${issueKey}`,
  );
  return page.comments.map(toComment);
}

export async function searchIssueKeys(jql: string, max = 50): Promise<string[]> {
  const page = await json<{ issues: Array<{ key: string }> }>(
    await api.asApp().requestJira(route`/rest/api/3/search/jql?jql=${jql}&maxResults=${String(max)}&fields=summary`),
    'Searching issues',
  );
  return page.issues.map((issue) => issue.key);
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const page = await json<{ values: ProjectSummary[] }>(
    await api.asApp().requestJira(route`/rest/api/3/project/search?maxResults=100&orderBy=name`),
    'Listing projects',
  );
  return page.values.map((p) => ({ key: p.key, name: p.name }));
}

export async function isValidJql(jql: string): Promise<boolean> {
  const response = await api.asApp().requestJira(route`/rest/api/3/jql/parse?validation=strict`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries: [jql] }),
  });
  if (!response.ok) return false;
  const result = (await response.json()) as { queries: Array<{ errors?: string[] }> };
  return (result.queries[0]?.errors ?? []).length === 0;
}

/** Whether the current user is a Jira administrator. */
export async function currentUserIsAdmin(): Promise<boolean> {
  const response = await api.asUser().requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`);
  if (!response.ok) return false;
  const result = (await response.json()) as { permissions?: { ADMINISTER?: { havePermission?: boolean } } };
  return result.permissions?.ADMINISTER?.havePermission === true;
}
