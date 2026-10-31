import { Queue } from '@forge/events';

export type HarvestJob =
  | { type: 'scan' }
  | { type: 'page'; pageId: string }
  | { type: 'comment'; issueKey: string; commentId: string };

/** Must match the consumer's queue in manifest.yml. */
export const HARVEST_QUEUE = 'precedent-harvest';

const BATCH = 50;

export async function enqueueHarvest(jobs: HarvestJob[], delayInSeconds?: number): Promise<void> {
  const queue = new Queue<HarvestJob>({ key: HARVEST_QUEUE });
  for (let i = 0; i < jobs.length; i += BATCH) {
    await queue.push(jobs.slice(i, i + BATCH).map((body) => ({ body, delayInSeconds })));
  }
}
