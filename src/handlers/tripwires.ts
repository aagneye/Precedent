import { loadContext } from '../app/context';
import { sweepTripwires } from '../tripwires/run';

/** Scheduled: re-check every watched assumption and open reviews for newly broken decisions. */
export async function tripwireSweep(): Promise<void> {
  const app = await loadContext();
  const result = await sweepTripwires(app);
  console.log(
    `Tripwire sweep: ${result.checked} assumptions in ${result.decisions} decisions, ${result.changed} changed, ` +
      `${result.broken.length} newly broken${result.broken.length ? `: ${result.broken.map((b) => b.key).join(', ')}` : ''}`,
  );
}
