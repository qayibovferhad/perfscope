import { fmtMs, fmtCls, type RumMetricKey } from '@perfscope/shared';
import { Website, type IWebsite } from '../models/Website.model.js';
import { getRumSummary } from './rum.service.js';
import { dispatchAlert } from './alerts.service.js';

/**
 * Budgets, evaluated against what real visitors got rather than against a lab run.
 *
 * This is the check a lab audit cannot make. A page can pass every synthetic threshold
 * and still be slow for the people using it — different devices, worse networks, a
 * third-party script that only loads for logged-in users. Field p75 is the number that
 * decides whether the site is actually fast, so it deserves the same alerting.
 *
 * Runs on a schedule rather than per audit: beacons arrive continuously, and there is no
 * single event to hang the check on.
 */

/** Which budget thresholds have a field equivalent. tbt and performance are lab-only. */
const FIELD_BUDGET_METRICS = ['lcp', 'cls', 'inp'] as const;
type FieldBudgetMetric = (typeof FIELD_BUDGET_METRICS)[number];

/** Window the p75 is computed over — long enough to be stable, short enough to be current. */
const WINDOW_DAYS = 7;

/**
 * Below this many page views a p75 is not a measurement, it is an anecdote. Alerting on
 * three visits would fire on whoever happened to load the page on a train.
 */
const MIN_SAMPLES = 50;

interface FieldFailure {
  metric: FieldBudgetMetric;
  value:  number;
  budget: number;
  samples: number;
}

function describe(f: FieldFailure): string {
  const format = f.metric === 'cls' ? fmtCls : fmtMs;
  return `${f.metric.toUpperCase()} p75 ${format(f.value)} across ${f.samples} page views (target ≤ ${format(f.budget)})`;
}

async function evaluate(site: IWebsite): Promise<FieldFailure[]> {
  const budgets = site.budgets;
  if (!budgets) return [];

  const summary = await getRumSummary({ websiteId: site._id, days: WINDOW_DAYS });

  const failures: FieldFailure[] = [];
  for (const metric of FIELD_BUDGET_METRICS) {
    const budget = budgets[metric];
    if (budget == null) continue;

    const measured = summary.metrics[metric as RumMetricKey];
    if (!measured || measured.samples < MIN_SAMPLES) continue;

    if (measured.p75 > budget) {
      failures.push({ metric, value: measured.p75, budget, samples: measured.samples });
    }
  }
  return failures;
}

/**
 * One site's field budgets. A breach persists until the site actually gets faster, so it
 * is an incident: announced once, closed by a recovery notice. Kept under its own event
 * name so a field breach and a lab breach are separate incidents — they can be true at
 * different times and mean different things.
 */
async function checkFieldBudgets(site: IWebsite): Promise<void> {
  if (!site.budgets?.webhookUrl && !site.budgets?.alertEmail) return;

  const failures = await evaluate(site);

  if (failures.length === 0) {
    await dispatchAlert(site, {
      kind:   'field data back on target',
      event:  'rum.recovered',  // stored key — dedup matches it against existing incidents
      status: 'recovered',
      url:    site.url,
      formFactor: null,
      metrics: [],
      lines:  ['Real users are back inside every target.'],
      payload: {},
    });
    return;
  }

  console.warn(`[RUM targets] ${site.url} missed in the field: ${failures.map(f => f.metric).join(', ')}`);

  await dispatchAlert(site, {
    kind:   'field target missed',
    event:  'rum.breach',  // stored key — see above
    status: 'firing',
    url:    site.url,
    formFactor: null,
    metrics: failures.map(f => f.metric),
    lines:  failures.map(describe),
    payload: { window: `${WINDOW_DAYS}d`, failures },
  });
}

/** Every site with both budgets and somewhere to send. */
export async function checkAllFieldBudgets(): Promise<void> {
  const sites = await Website.find({
    budgets: { $ne: null },
    rumKey:  { $ne: null },
    $or: [{ 'budgets.webhookUrl': { $ne: null } }, { 'budgets.alertEmail': { $ne: null } }],
  });

  for (const site of sites) {
    await checkFieldBudgets(site)
      .catch((err: unknown) => console.warn('[RUM budgets] Check failed for', site.url, err));
  }
}
