/**
 * Probe: can a recorded budget breach actually be cleared?
 *
 * `lastBudgetBreach` is a single flag on the Website, and recording it is last-wins — a
 * breach on /checkout replaces one on /. Clearing it used to require a clean audit of the
 * *exact* URL that broke, so the two halves disagreed: a site whose schedule audits
 * /requests could never clear a breach recorded on its root, and the badge stayed lit
 * forever. That is what this checks.
 *
 * From apps/backend:
 *
 *     npx tsx probes/budget-breach.probe.mts
 */
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { Website } from '../src/models/Website.model.js';
import { checkBudgets } from '../src/services/budget.service.js';
import type { AnalysisResult } from '@perfscope/shared';

await mongoose.connect(config.mongoUri);

const userId = new mongoose.Types.ObjectId().toString();
const ROOT   = 'https://breach-probe.example.com';

/** A result good enough for `hasResult`, at whatever score is asked for. */
const audit = (url: string, performance: number, lcp: number): AnalysisResult => ({
  id: `breach-probe-${Math.random().toString(16).slice(2)}`,
  url,
  timestamp: new Date().toISOString(),
  formFactor: 'desktop',
  scores:  { performance, accessibility: 100, bestPractices: 100, seo: 100 },
  metrics: { fcp: 500, lcp, tbt: 10, cls: 0.01, si: 700, tti: 900 },
  audits:  [],
});

async function site() {
  return (await Website.findOne({ userId, url: ROOT }))!;
}

try {
  await Website.create({
    userId, url: ROOT, name: 'Breach Probe',
    budgets: { performance: 90, lcp: 2000, tbt: null, cls: null, inp: null, webhookUrl: null, alertEmail: null },
    // The shape that caused the bug: the timetable never visits the page that broke.
    automation: { enabled: true, routes: ['/requests'], scheduleTime: '03:00' },
  });

  // 1. A bad audit of the root records a breach.
  await checkBudgets(audit(ROOT, 61, 3300), await site());
  const recorded = (await site()).lastBudgetBreach;
  console.log(`breach recorded on the root : ${recorded ? `yes (${recorded.failures.map(f => f.metric).join(', ')})` : 'NO'}`);

  // 2. A clean audit of a *different* route clears it. This is the case that used to be
  //    impossible, and it is the one a schedule actually produces.
  await checkBudgets(audit(`${ROOT}/requests`, 97, 900), await site());
  const afterOther = (await site()).lastBudgetBreach;
  console.log(`cleared by a clean /requests: ${afterOther ? 'NO — still lit' : 'yes'}`);

  // 3. Still records again when something really is over budget.
  await checkBudgets(audit(`${ROOT}/requests`, 55, 4000), await site());
  const again = (await site()).lastBudgetBreach;
  console.log(`records again on a breach   : ${again ? `yes (on ${again.url})` : 'NO'}`);

  // 4. A failed run must neither set nor clear anything. `hasResult` treats *any* non-zero
  //    score or metric as a real result, so this has to be genuinely all zeros — an earlier
  //    version of this probe left the metrics populated and passed for the wrong reason.
  const failed: AnalysisResult = {
    ...audit(`${ROOT}/requests`, 0, 0),
    scores:  { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 },
    metrics: { fcp: 0, lcp: 0, tbt: 0, cls: 0, si: 0, tti: 0 },
  };
  const before = (await site()).lastBudgetBreach;
  await checkBudgets(failed, await site());
  const afterZero = (await site()).lastBudgetBreach;
  const untouched = !!afterZero && afterZero.url === before?.url;
  console.log(`an all-zero failed run      : ${untouched ? 'left it alone ✓' : 'CHANGED IT — a failed run carries no signal'}`);

  const pass = !!recorded && !afterOther && !!again && untouched;
  console.log(`\n  ${pass ? 'PASS — the flag can be both set and cleared by a real schedule.' : 'FAIL'}`);
} finally {
  const { deletedCount } = await Website.deleteMany({ userId });
  console.log(`cleaned up ${deletedCount} site(s)`);
  await mongoose.disconnect();
}
