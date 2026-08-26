import { runScheduledFlows } from '../services/flowSchedule.service.js';
import { registerCron } from '../lib/cron.js';

/**
 * Scheduled flows, on the same per-minute tick the nightly audits use.
 *
 * Its own file rather than a branch inside the nightly cron: they answer different
 * questions on different objects — one audits a site's routes, the other replays a journey
 * through one of them — and the flow scheduler carries a re-entrancy guard the audits do
 * not need, because a flow can outlast its own minute.
 */
function currentHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function registerFlowCron(): void {
  registerCron({
    expression: '* * * * *',
    tag:        '[FlowSchedule]',
    announce:   'Scheduled user flows running every minute — triggers per flow schedule time.',
    run:        () => runScheduledFlows(currentHHMM()),
  });
}
