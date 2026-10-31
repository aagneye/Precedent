import { Queue } from '@forge/events';
import type { AppContext } from '../app/context';
import { saveSettings, type DemoState } from '../config/settings';
import { doc, paragraph } from '../integrations/adf';
import { createPage, trashPage } from '../integrations/confluence';
import { addComment, createIssue } from '../integrations/jira';
import { sweepTripwires } from '../tripwires/run';
import { ACME_ISSUES, ACME_PAGES, acmeDecisions, DEMO_INDEX, incidentIssues } from './acme';

export interface DemoJob extends Record<string, unknown> {
  type: 'load';
  projectKey: string;
  spaceId?: string;
  actorAccountId?: string;
}

/** Must match the demo consumer's queue in manifest.yml. */
export const DEMO_QUEUE = 'precedent-demo';

export async function enqueueDemo(job: DemoJob): Promise<void> {
  await new Queue<DemoJob>({ key: DEMO_QUEUE }).push({ body: job });
}

interface CreatedPage {
  id: string;
  url: string;
  title: string;
}

/**
 * Creates the Acme Pay pages (when a space is given) and issues, files their decisions, and runs the
 * tripwires once so every assumption has a state. Takes tens of seconds, so it runs on a queue.
 */
export async function loadDemo(app: AppContext, job: DemoJob): Promise<DemoState> {
  const pages = new Map<string, CreatedPage>();
  const pageIds: string[] = [];
  if (job.spaceId) {
    const index = await createPage(job.spaceId, DEMO_INDEX.title, DEMO_INDEX.storage);
    pageIds.push(index.id);
    for (const page of ACME_PAGES) {
      const created = await createPage(job.spaceId, page.title, page.storage, index.id);
      pages.set(page.slug, { ...created, title: page.title });
      pageIds.push(created.id);
    }
  }

  const issueKeys: string[] = [];
  for (const issue of ACME_ISSUES) {
    const key = await createIssue({ projectKey: job.projectKey, summary: issue.summary, description: doc(paragraph(issue.description)), labels: issue.labels });
    if (issue.comment) await addComment(key, doc(paragraph(issue.comment)));
    issueKeys.push(key);
  }

  for (const d of acmeDecisions(job.projectKey, new Date())) {
    const page = pages.get(d.pageSlug);
    const pageTitle = page?.title ?? ACME_PAGES.find((p) => p.slug === d.pageSlug)?.title ?? 'Acme Pay handbook';
    await app.store.create({
      title: d.title,
      statement: d.statement,
      rationale: d.rationale,
      status: d.status,
      origin: 'demo',
      originLabel: d.status === 'candidate' ? `Found in "${pageTitle}"` : undefined,
      ownerAccountId: job.actorAccountId,
      deciders: job.actorAccountId ? [job.actorAccountId] : [],
      decidedAt: d.decidedAt,
      tags: d.tags,
      sources: [
        page
          ? { kind: 'confluence_page', ref: page.id, url: page.url, title: page.title, excerpt: d.statement }
          : { kind: 'manual', ref: `demo:${d.pageSlug}`, title: pageTitle, excerpt: d.statement },
      ],
      assumptions: d.assumptions,
    });
  }

  const state: DemoState = {
    projectKey: job.projectKey,
    spaceId: job.spaceId,
    issueKeys,
    pageIds,
    loadedAt: new Date().toISOString(),
    status: 'ready',
  };
  const settings = await saveSettings({ demo: state, reviewProjectKey: app.settings.reviewProjectKey ?? job.projectKey });
  await sweepTripwires({ ...app, settings });
  return state;
}

/** Files P1 incidents in the demo project, enough to break the single-region decision's tripwire. */
export async function fileDemoIncidents(projectKey: string, count = 3): Promise<string[]> {
  const keys: string[] = [];
  for (const issue of incidentIssues(count, new Date())) {
    keys.push(
      await createIssue({
        projectKey,
        summary: issue.summary,
        description: doc(paragraph(issue.description)),
        labels: issue.labels,
        issueTypes: ['Incident', 'Bug', 'Task'],
      }),
    );
  }
  return keys;
}

/** Removes the demo decisions and moves the demo pages to the trash. Demo issues stay, labelled for cleanup. */
export async function resetDemo(app: AppContext): Promise<number> {
  const removed = await app.store.deleteByOrigin('demo');
  for (const id of app.settings.demo?.pageIds ?? []) await trashPage(id).catch(() => undefined);
  await saveSettings({ demo: undefined });
  return removed;
}
