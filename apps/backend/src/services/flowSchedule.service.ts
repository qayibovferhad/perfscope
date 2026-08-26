/**
 * Running flows on their own, and saying so when one slips.
 *
 * A flow that only runs when somebody presses a button measures the day they pressed it.
 * The value of an interaction budget is the morning after a release, which is the same
 * reason nightly audits exist — so this borrows that shape: a per-minute cron, flows
 * matched on `schedule.time`, and the same alert path everything else uses.
 *
 * **Alerts go through the site.** `dispatchAlert` takes a Website because that is where the
 * channels live and what an incident is filed against, so a flow's alert is resolved to the
 * site its URL belongs to — `findWebsiteByHost`, exactly as a persisted audit does. A flow
 * against a URL the account does not track cannot alert, and the UI says so rather than
 * this inventing a second, parallel notification system.
 */
import {
  collectFlowTargetFailures, fmtMs, fmtCls,
  type FlowTargetFailure, type FlowRunResult,
} from '@perfscope/shared';
import { Flow, type IFlow } from '../models/Flow.model.js';
import { FlowRun } from '../models/FlowRun.model.js';
import { runFlow } from './flow.service.js';
import { findWebsiteByHost } from './websiteLookup.js';
import { findSessionFor } from './sessionStore.js';
import { dispatchAlert } from './alerts.service.js';

/**
 * How long after a scheduled run the same flow may not run again.
 *
 * The cron ticks every minute and a flow takes minutes, so without this a flow whose run
 * outlasts its own minute would be started again on the next tick — the re-entrancy bug the
 * nightly cron already had once. Bookkeeping lives on the document (`lastScheduledAt`)
 * rather than in memory so it survives a restart and holds across instances.
 */
const RERUN_GUARD_MS = 20 * 60 * 1000;

const METRIC_LABEL: Record<FlowTargetFailure['metric'], string> = { inp: 'INP', tbt: 'TBT', cls: 'CLS' };

/** One failure as a line a person reads in an email or a Slack message. */
export function describeFlowFailure(failure: FlowTargetFailure): string {
  const value  = failure.metric === 'cls' ? fmtCls(failure.value)  : fmtMs(failure.value);
  const target = failure.metric === 'cls' ? fmtCls(failure.target) : fmtMs(failure.target);
  return `${METRIC_LABEL[failure.metric]} on "${failure.step}" is ${value}, over the ${target} target`;
}

/**
 * Check a finished run against its flow's targets and raise (or clear) the alert.
 *
 * Exported because a manual run is checked too: a target that only fires overnight is a
 * target somebody discovers a day late, and the socket path runs this as well.
 */
export async function checkFlowTargets(flow: IFlow, result: FlowRunResult): Promise<FlowTargetFailure[]> {
  const failures = collectFlowTargetFailures(result.steps, flow.targets);

  const site = await findWebsiteByHost(String(flow.userId), flow.url);
  if (!site) return failures;   // nothing to file an incident against, and nowhere to send

  const base = {
    url: flow.url,
    formFactor: result.formFactor,
    metrics: failures.map(f => f.metric),
    analysisId: result.id,
    payload: { flowId: String(flow._id), flowName: flow.name, flowRunId: result.id },
  };

  if (failures.length === 0) {
    // Closed the same way a budget breach is: the log, not the flow, is the record of
    // whether anyone was told.
    await dispatchAlert(site, {
      ...base,
      kind:   'flow back on target',
      event:  'flow.recovered',
      status: 'recovered',
      lines:  [`Every interaction target met again on "${flow.name}".`],
    });
    return failures;
  }

  await dispatchAlert(site, {
    ...base,
    kind:   'flow target missed',
    // A `firing` incident rather than a point-in-time event: an interaction that got slow
    // stays slow until somebody fixes it, and alerting nightly about the same click is how
    // people turn alerts off.
    event:  'flow.breach',
    status: 'firing',
    lines:  failures.map(describeFlowFailure),
  });

  return failures;
}

/**
 * Every flow due at this minute, run one after another.
 *
 * `run` exists so the scheduler can be exercised without launching a browser: what is worth
 * testing here is *which* flows are picked and that one cannot start twice, and ten minutes
 * of real Chrome proves none of that. An ES module's exports cannot be substituted from
 * outside (they are read-only bindings), so the seam is a parameter rather than the
 * monkey-patch the nightly audit probe uses on its service *object*.
 */
export async function runScheduledFlows(
  hhmm: string,
  { run = runFlow }: { run?: typeof runFlow } = {},
): Promise<number> {
  const due = await Flow.find({ 'schedule.enabled': true, 'schedule.time': hhmm });
  if (due.length === 0) return 0;

  const cutoff = new Date(Date.now() - RERUN_GUARD_MS);
  let ran = 0;

  for (const flow of due) {
    if (flow.lastScheduledAt && flow.lastScheduledAt > cutoff) continue;

    // Marked *before* the run, not after: a flow that takes ten minutes would otherwise be
    // picked up again by every tick in between.
    flow.lastScheduledAt = new Date();
    await flow.save();

    try {
      const session = await findSessionFor(String(flow.userId), flow.url);
      const result = await run(
        {
          name: flow.name, url: flow.url, steps: flow.steps,
          snapshotAtEnd: flow.snapshotAtEnd, formFactor: flow.formFactor,
        },
        // Background: a person waiting on a page outranks a schedule, and the queue knows it.
        { session, priority: 'background' },
      );

      const stored = await FlowRun.create({
        userId: flow.userId, flowId: flow._id, name: result.name, url: result.url,
        formFactor: result.formFactor, steps: result.steps, durationMs: result.durationMs,
      });

      await checkFlowTargets(flow, { ...result, id: String(stored._id) });
      ran++;
      console.log(`[FlowSchedule] Ran "${flow.name}" (${result.durationMs}ms)`);
    } catch (err) {
      // One flow's broken selector must not stop the others due at the same minute.
      console.error(`[FlowSchedule] "${flow.name}" failed:`, (err as Error).message);
    }
  }

  return ran;
}
