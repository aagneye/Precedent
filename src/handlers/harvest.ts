import { BudgetExceededError } from '../ai/llm';
import { loadContext, today } from '../app/context';
import { getSettings } from '../config/settings';
import { commentItem, pageItem, scanJobs, scannedProjects, scannedSpaces } from '../harvest/collect';
import { enqueueHarvest, type HarvestJob } from '../harvest/jobs';
import { harvestItem, type HarvestItem } from '../harvest/pipeline';

interface CommentEvent {
  issue?: { key?: string; fields?: { project?: { key?: string } } };
  comment?: { id?: string };
}

interface PageEvent {
  content?: { id?: string };
}

/** Trigger: a Jira comment was created. Queues it if its project is scanned. */
export async function onJiraComment(event: CommentEvent): Promise<void> {
  const issueKey = event.issue?.key;
  const commentId = event.comment?.id;
  if (!issueKey || !commentId) return;
  const settings = await getSettings();
  const projectKey = event.issue?.fields?.project?.key ?? issueKey.split('-')[0];
  if (!settings.ai.harvest || !scannedProjects(settings).includes(projectKey)) return;
  await enqueueHarvest([{ type: 'comment', issueKey, commentId: String(commentId) }]);
}

/**
 * Seconds to wait before reading a changed page. This lets bursts of edits settle, and gives demo
 * seeding (which creates pages, then their decisions) time to file the sources first.
 */
const PAGE_SETTLE_SECONDS = 120;

/** Trigger: a Confluence page was created or updated. The consumer checks the space after reading the page. */
export async function onConfluencePage(event: PageEvent): Promise<void> {
  const pageId = event.content?.id;
  if (!pageId) return;
  const settings = await getSettings();
  if (!settings.ai.harvest || scannedSpaces(settings).length === 0) return;
  await enqueueHarvest([{ type: 'page', pageId: String(pageId) }], PAGE_SETTLE_SECONDS);
}

/** Scheduled: re-scan the configured spaces and projects once a day. */
export async function harvestSweep(): Promise<void> {
  const settings = await getSettings();
  if (settings.ai.harvest) await enqueueHarvest([{ type: 'scan' }]);
}

/** Queue consumer: expands scans and extracts decisions from single pages and comments. */
export async function harvestConsumer(event: { body: HarvestJob }): Promise<void> {
  const context = await loadContext();
  if (!context.settings.ai.harvest) return;
  const job = event.body;

  if (job.type === 'scan') {
    await enqueueHarvest(await scanJobs(context.settings));
    return;
  }

  let item: HarvestItem | undefined;
  if (job.type === 'page') {
    const page = await pageItem(job.pageId);
    if (!page || !scannedSpaces(context.settings).includes(page.spaceId)) return;
    item = page.item;
  } else {
    item = await commentItem(job.issueKey, job.commentId);
  }
  if (!item) return;

  try {
    const result = await harvestItem(item, { store: context.store, llm: context.llm, today });
    console.log(`Harvested ${item.kind} ${item.ref}: ${result.created.join(', ') || result.skipped}`);
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      console.warn(`Skipped ${item.kind} ${item.ref}: ${error.message}`);
      return;
    }
    throw error;
  }
}
