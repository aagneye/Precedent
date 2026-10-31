import { loadContext } from '../app/context';
import { graphLookups } from '../tripwires/graphLookups';
import { jiraLookups, sweepTripwires } from '../tripwires/run';

/**
 * Scheduled: re-check every watched assumption and open reviews for newly broken decisions.
 * Teamwork Graph only answers on behalf of a user, so the sweep asks as the admin who configured
 * Precedent, and falls back to Jira-only lookups when nobody has yet.
 */
export async function tripwireSweep(): Promise<void> {
  const app = await loadContext();
  const admin = app.settings.adminAccountId;
  const result = await sweepTripwires(app, admin ? graphLookups(admin) : jiraLookups);
  console.log(
    `Tripwire sweep: ${result.checked} assumptions in ${result.decisions} decisions, ${result.changed} changed, ` +
      `${result.broken.length} newly broken${result.broken.length ? `: ${result.broken.map((b) => b.key).join(', ')}` : ''}`,
  );
}
