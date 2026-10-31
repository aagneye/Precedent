import { loadContext } from '../app/context';
import { saveSettings } from '../config/settings';
import { loadDemo, type DemoJob } from '../demo/seed';

/** Queue consumer: builds the Acme Pay demo company and records whether it worked. */
export async function demoConsumer(event: { body: DemoJob }): Promise<void> {
  const app = await loadContext();
  try {
    const state = await loadDemo(app, event.body);
    console.log(`Demo loaded: ${state.issueKeys.length} issues, ${state.pageIds.length} pages`);
  } catch (error) {
    const message = (error as Error).message;
    console.error(`Demo load failed: ${message}`);
    await saveSettings({
      demo: {
        projectKey: event.body.projectKey,
        spaceId: event.body.spaceId,
        issueKeys: [],
        pageIds: [],
        loadedAt: new Date().toISOString(),
        status: 'failed',
        error: message,
      },
    });
  }
}
