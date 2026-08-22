/**
 * Every audit the analyzer shows now claims a category, and accessibility audits claim a
 * group inside it — that is what the filter bar and the grouped accessibility view are
 * built on. Both facts come from Lighthouse's own `categories[*].auditRefs` and
 * `categoryGroups`, so this probe checks them against a real LHR rather than a fixture
 * that could go stale at the next Lighthouse release.
 *
 * It also prints how much bigger the per-category cap made the audit list and the stored
 * result — the number the plan budgets against.
 *
 * From apps/backend (add --no-live to skip the Lighthouse run and check the pure logic only):
 *
 *     npx tsx probes/audit-categories.probe.mts
 */
import { buildAuditPlacements, extractFailingAudits } from '../src/services/lhr-transform.js';
import type { RunnerResult } from 'lighthouse';

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

// ─── 1. The cap is per category, not per LHR ──────────────────────────────────
// A synthetic LHR, because the point is the budgeting rule and a real page cannot be
// relied on to fail twenty accessibility audits on demand.

const synthetic = (() => {
  const audits: Record<string, { score: number; title: string }> = {};
  const refs: Record<string, { id: string; group?: string }[]> = {
    performance: [], accessibility: [], 'best-practices': [], seo: [],
  };

  // 20 failing audits in each of two categories — more than one category's budget.
  for (let i = 0; i < 20; i++) {
    audits[`a11y-${i}`] = { score: 0.1, title: `Accessibility problem ${i}` };
    refs['accessibility']!.push({ id: `a11y-${i}`, group: 'a11y-color-contrast' });
    audits[`perf-${i}`] = { score: 0.2, title: `Performance problem ${i}` };
    refs['performance']!.push({ id: `perf-${i}`, group: 'load-opportunities' });
  }
  // One passing audit, which must never be reported.
  audits['seo-fine'] = { score: 1, title: 'A passing SEO audit' };
  refs['seo']!.push({ id: 'seo-fine' });

  return {
    categories: Object.fromEntries(
      Object.entries(refs).map(([key, auditRefs]) => [key, { auditRefs }]),
    ),
    categoryGroups: {
      'a11y-color-contrast': { title: 'Contrast' },
      'load-opportunities':  { title: 'Opportunities' },
    },
    audits,
  } as unknown as RunnerResult['lhr'];
})();

const placements = buildAuditPlacements(synthetic);
const capped = extractFailingAudits(synthetic.audits as never, placements);
const byCategory = capped.reduce<Record<string, number>>((acc, a) => {
  const key = a.category ?? 'none';
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

console.log('\nsynthetic LHR: 20 failing accessibility + 20 failing performance audits');
console.log(`  kept: ${JSON.stringify(byCategory)}`);
check(byCategory['accessibility'] === 15, `accessibility keeps its own 15 (${byCategory['accessibility']})`);
check(byCategory['performance'] === 15, `performance keeps its own 15 (${byCategory['performance']})`);
check(capped.length === 30, `30 audits in total — one shared cap would have given 15 (${capped.length})`);
check(!capped.some(a => a.id === 'seo-fine'), 'a passing audit is still never reported');
check(capped.every(a => a.category), 'every kept audit carries its category');
check(capped.filter(a => a.category === 'accessibility').every(a => a.group === 'Contrast'),
  'the group is the display title, not the raw group id');

// An audit no category references must not slip past the cap unbudgeted.
const orphans: Record<string, { score: number; title: string }> = {};
for (let i = 0; i < 20; i++) orphans[`orphan-${i}`] = { score: 0.3, title: `Orphan ${i}` };
const orphanKept = extractFailingAudits(orphans as never, new Map());
check(orphanKept.length === 15, `audits with no placement share one bucket of 15 (${orphanKept.length})`);
check(orphanKept.every(a => a.category === undefined), 'and claim no category rather than a wrong one');

// ─── 2. The real thing ────────────────────────────────────────────────────────
if (!process.argv.includes('--no-live')) {
  const { lighthouseService } = await import('../src/services/lighthouse.service.js');

  // A page with real accessibility failures — example.com passes almost everything, which
  // would make "accessibility audits carry a group" vacuously true.
  const url = process.env['PROBE_URL'] ?? 'https://www.wikipedia.org';
  console.log(`\nlive audit of ${url} …`);
  const result = await lighthouseService.analyze(url);

  const counts = result.audits.reduce<Record<string, number>>((acc, a) => {
    const key = a.category ?? 'none';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  audits: ${result.audits.length} — ${JSON.stringify(counts)}`);
  console.log(`  fullResult: ${(JSON.stringify(result).length / 1024).toFixed(0)} KB`);

  check(result.audits.length > 0, 'the run reported failing audits at all');
  check(result.audits.every(a => a.category !== undefined),
    `every audit carries a category (${result.audits.filter(a => !a.category).map(a => a.id).join(', ') || 'all placed'})`);
  check(result.audits.every(a => a.category !== 'none'), 'no audit fell through to the unplaced bucket');

  const a11y = result.audits.filter(a => a.category === 'accessibility');
  console.log(`  accessibility groups: ${[...new Set(a11y.map(a => a.group ?? '—'))].join(', ') || '(none failing)'}`);
  if (a11y.length > 0) {
    check(a11y.some(a => a.group), 'accessibility audits carry Lighthouse\'s group title');
  } else {
    console.log('  SKIP  no accessibility audit failed on this page — group check not exercised');
  }

  const scores = result.audits.map(a => a.score ?? 1);
  check(scores.every((s, i) => i === 0 || scores[i - 1]! <= s), 'the merged list is ordered worst first');
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
