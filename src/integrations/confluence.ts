import api, { route, type APIResponse } from '@forge/api';
import { siteBaseUrl } from './jira';
import { storageToText } from './storageFormat';

export interface PageContent {
  id: string;
  title: string;
  spaceId: string;
  text: string;
  authorAccountId?: string;
  createdAt?: string;
  url: string;
}

export interface SpaceSummary {
  id: string;
  key: string;
  name: string;
}

async function json<T>(response: APIResponse, what: string): Promise<T> {
  if (!response.ok) throw new Error(`${what} failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return (await response.json()) as T;
}

async function pageUrl(webui: string | undefined, id: string): Promise<string> {
  const base = await siteBaseUrl();
  return webui ? `${base}/wiki${webui}` : `${base}/wiki/pages/viewpage.action?pageId=${id}`;
}

interface RawPage {
  id: string;
  title: string;
  spaceId: string;
  authorId?: string;
  createdAt?: string;
  body?: { storage?: { value?: string } };
  _links?: { webui?: string };
}

export async function getPage(id: string): Promise<PageContent | undefined> {
  const response = await api.asApp().requestConfluence(route`/wiki/api/v2/pages/${id}?body-format=storage`);
  if (response.status === 404) return undefined;
  const page = await json<RawPage>(response, `Reading page ${id}`);
  return {
    id: page.id,
    title: page.title,
    spaceId: page.spaceId,
    text: storageToText(page.body?.storage?.value ?? ''),
    authorAccountId: page.authorId,
    createdAt: page.createdAt,
    url: await pageUrl(page._links?.webui, page.id),
  };
}

export async function listSpaces(): Promise<SpaceSummary[]> {
  const page = await json<{ results: SpaceSummary[] }>(
    await api.asApp().requestConfluence(route`/wiki/api/v2/spaces?limit=100&sort=name`),
    'Listing spaces',
  );
  return page.results.map((s) => ({ id: s.id, key: s.key, name: s.name }));
}

export async function listPageIds(spaceId: string, max = 25): Promise<string[]> {
  const page = await json<{ results: Array<{ id: string }> }>(
    await api.asApp().requestConfluence(route`/wiki/api/v2/spaces/${spaceId}/pages?limit=${String(max)}&sort=-modified-date`),
    `Listing pages in space ${spaceId}`,
  );
  return page.results.map((p) => p.id);
}

export async function createPage(spaceId: string, title: string, storage: string, parentId?: string): Promise<{ id: string; url: string }> {
  const page = await json<RawPage>(
    await api.asApp().requestConfluence(route`/wiki/api/v2/pages`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spaceId,
        status: 'current',
        title,
        ...(parentId ? { parentId } : {}),
        body: { representation: 'storage', value: storage },
      }),
    }),
    `Creating page "${title}"`,
  );
  return { id: page.id, url: await pageUrl(page._links?.webui, page.id) };
}

/** Moves a page to the space's trash. */
export async function trashPage(id: string): Promise<void> {
  const response = await api.asApp().requestConfluence(route`/wiki/api/v2/pages/${id}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) throw new Error(`Deleting page ${id} failed (${response.status})`);
}
