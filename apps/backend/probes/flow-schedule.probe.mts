/**
 * The scheduler and the targets, without burning ten minutes of Chrome.
 *
 * A stub runner is handed to the scheduler so nothing launches a browser: what is being
 * checked here is *which flows the cron picks*, that it cannot pick the same one twice while
 * it is still running, and that a run over its target raises the alert — none of which need
 * a real measurement. The measurement itself has its own probe (`flow.probe.mts`).
 *
 *   cd apps/backend && npx tsx probes/flow-schedule.probe.mts
 */
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.model.js';
import { Website } from '../src/models/Website.model.js';
import { Flow } from '../src/models/Flow.model.js';
import { FlowRun } from '../src/models/FlowRun.model.js';
import { AlertLog } from '../src/models/AlertLog.model.js';
import { runScheduledFlows, checkFlowTargets, describeFlowFailure } from '../src/services/flowSchedule.service.js';
import type { FlowRunResult } from '@perfscope/shared';

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

/** A result shaped like a real one, with the interaction number under our control. */
const resultWith = (inp: number): FlowRunResult => ({
  id: 'stub', flowId: '', name: 'Probe flow', url: 'https://probe.test/',
  formFactor: 'desktop', timestamp: new Date().toISOString(), durationMs: 1234,
  steps: [
    { name: 'Page load', mode: 'navigation', scores: { performance: 90 }, metrics: { lcp: 1200, tbt: 40 }, audits: [] },
    { name: 'Open the panel', mode: 'timespan', scores: { performance: 80 }, metrics: { inp, tbt: 200, cls: 0 }, audits: [] },
  ],
});

await mongoose.connect(config.mongoUri);

const email = `flow-sched-${Date.now()}@probe.test`;
const user = await User.create({ name: 'Flow Schedule Probe', email, provider: 'email' });

// A site with a channel: `dispatchAlert` needs one, and an alert nobody could receive is
// recorded with an empty delivery rather than not recorded at all.
const site = await Website.create({
  userId: user._id, url: 'https://probe.test', name: 'Probe site',
  budgets: { webhookUrl: 'https://hooks.probe.test/nowhere', alertEmail: null },
});

const ranUrls: string[] = [];
/** Stands in for the real runner: records what it was asked to run, measures nothing. */
const stubRunner = (async (definition: { url: string }) => {
  ranUrls.push(definition.url);
  return resultWith(340);
}) as unknown as Parameters<typeof runScheduledFlows>[1] extends { run?: infer R } ? R : never;

try {
  // ─── Who the cron picks ────────────────────────────────────────────────────
  const due = await Flow.create({
    userId: user._id, name: 'Due at 04:00', url: 'https://probe.test/checkout',
    steps: [{ action: 'click', selector: '#pay', measure: true }],
    schedule: { enabled: true, time: '04:00' }, targets: { inp: 200, tbt: null, cls: null },
  });
  await Flow.create({
    userId: user._id, name: 'Due later', url: 'https://probe.test/later',
    steps: [{ action: 'click', selector: '#x', measure: true }],
    schedule: { enabled: true, time: '05:00' },
  });
  await Flow.create({
    userId: user._id, name: 'Disabled', url: 'https://probe.test/off',
    steps: [{ action: 'click', selector: '#x', measure: true }],
    schedule: { enabled: false, time: '04:00' },
  });

  const ran = await runScheduledFlows('04:00', { run: stubRunner });
  check(ran === 1, `only the flow due at that minute runs (${ran})`);
  check(ranUrls.length === 1 && ranUrls[0] === 'https://probe.test/checkout',
    `and it is the right one (${ranUrls.join(', ') || 'none'})`);

  const stored = await FlowRun.find({ flowId: due._id });
  check(stored.length === 1, 'the run is stored against its flow');

  // ─── It cannot start the same flow twice ───────────────────────────────────
  // The cron ticks every minute and a flow takes minutes: without the guard the same flow
  // is started again on the next tick, which is the re-entrancy bug the nightly cron had.
  const again = await runScheduledFlows('04:00', { run: stubRunner });
  check(again === 0, 'a flow already running this cycle is not started again');
  check(ranUrls.length === 1, 'so nothing ran twice');

  // ─── The target, and the alert ─────────────────────────────────────────────
  const missed = await checkFlowTargets(due, resultWith(340));
  check(missed.length === 1 && missed[0]?.metric === 'inp', 'a run over the target reports it');
  check(missed[0]?.step === 'Open the panel', 'naming the step that missed, not the flow');
  check(/INP on "Open the panel" is 340ms, over the 200ms target/.test(describeFlowFailure(missed[0]!)),
    `and reads as a sentence (${describeFlowFailure(missed[0]!)})`);

  const firing = await AlertLog.findOne({ websiteId: site._id, event: 'flow.breach' }).lean();
  check(!!firing, 'an incident is opened against the site the flow belongs to');
  check(firing?.status === 'firing',
    'as a firing incident, not a point-in-time event — a slow click stays slow until it is fixed');

  // ─── And it closes ─────────────────────────────────────────────────────────
  const met = await checkFlowTargets(due, resultWith(120));
  check(met.length === 0, 'a run back inside the target reports nothing');
  // Stored under the *base* event, not under `flow.recovered`: a breach and its recovery are
  // two states of one incident, and `baseEvent()` is what lets the dedup read the latest.
  const recovered = await AlertLog.findOne({ websiteId: site._id, event: 'flow.breach', status: 'recovered' }).lean();
  check(!!recovered, 'and closes the incident, under the same event key');

  // ─── A flow on a URL the account does not track ────────────────────────────
  // There is nowhere to send and nothing to file against, so it must not throw — the run
  // still happened and is still stored.
  const untracked = await Flow.create({
    userId: user._id, name: 'Untracked', url: 'https://nobody-tracks-this.test/',
    steps: [{ action: 'click', selector: '#x', measure: true }],
    targets: { inp: 50, tbt: null, cls: null },
  });
  const orphanFailures = await checkFlowTargets(untracked, resultWith(340));
  check(orphanFailures.length === 1, 'a flow on an untracked URL still reports its own failures');
  const strayAlerts = await AlertLog.countDocuments({ userId: user._id, url: untracked.url });
  check(strayAlerts === 0, 'but files nothing, having no site to file it against');
} finally {
  await FlowRun.deleteMany({ userId: user._id });
  await Flow.deleteMany({ userId: user._id });
  await AlertLog.deleteMany({ userId: user._id });
  await Website.deleteOne({ _id: site._id });
  await User.deleteOne({ _id: user._id });
  await mongoose.disconnect();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
