/**
 * The exact evidence `analysePage` reasons over, as one block of text: scores, vitals,
 * longest tasks, heaviest resources, layout shifts, vendors, libraries, recommendation
 * history, and every failing audit with the details phase 1 taught `lhr-transform` to
 * keep. A separate module so `answerQuestion` can put the identical context in front of
 * the model — the point of the question box is that it sees exactly what the analysis
 * saw, not a fresh, cheaper summary of the same page — and so the probes can assert on
 * the context directly: this is pure string assembly, no Gemini, no I/O.
 */
import { rateVital, VITAL_THRESHOLDS, fmtMs } from '@perfscope/shared';
import type { AnalysisResult, ComparisonSide, CoreWebVitals, CruxData, RumSummary } from '@perfscope/shared';
import type { RecommendationHistoryEntry } from '../aiRecommendation.service.js';
import type { PreviousRun } from '../previousRun.service.js';
import type { CompetitorComparison } from '../competitorContext.service.js';
import { diffResources, resourceDiffHasChanges, formatResourceDiff } from '../../lib/resourceDiff.js';
import { attributeLongTasks } from '../../lib/longTaskAttribution.js';
import { compareLabAndField, formatGapLines, rumAsFieldData } from '../../lib/labFieldComparison.js';
import { findSitewideVendors, describeSitewideVendor, type OtherRouteVendors } from '../../lib/crossPageVendors.js';
import { pathOf } from '../../lib/url.js';

/** Failing audits explained per run. Fourteen covers a genuinely bad page without
 *  turning the response into a wall the reader skims past — explaining a passing audit
 *  would cost a token and say nothing. */
export const AUDIT_LIMIT = 14;

/**
 * How often a fix has come up before, in words rather than a number.
 *
 * The exact count used to go straight into the prompt ("given 21x"), and on a page a user
 * re-audits often the model started echoing it back verbatim — "for the twenty-first time,
 * still open" — on every recurring fix in the list, which reads as a scold rather than a
 * report the more a page gets re-audited. A bucket still tells the model this is old news
 * (and, past the "third audit or later" threshold, that it should escalate how it says so)
 * without handing it a number to turn into an ordinal.
 */
function repeatTier(timesGiven: number): string {
  if (timesGiven >= 5) return 'given many times before';
  if (timesGiven >= 2) return 'given a few times before';
  return 'given once before';
}

export interface PageContext {
  context: string;
  failing: AnalysisResult['audits'];
  poor: (keyof CoreWebVitals)[];
  hasSitewideVendors: boolean;
}

export function buildPageContext(
  result: AnalysisResult,
  previous?: PreviousRun | null,
  history?: RecommendationHistoryEntry[] | null,
  fieldData?: CruxData | null,
  otherRoutesVendors?: OtherRouteVendors[] | null,
  rumData?: RumSummary | null,
  competitor?: CompetitorComparison | null,
): PageContext {
  const vitals = (Object.keys(VITAL_THRESHOLDS) as (keyof CoreWebVitals)[])
    .filter(k => k in result.metrics);
  const poor = vitals.filter(k => rateVital(k, result.metrics[k]) !== 'good');

  const failing = result.audits
    .filter(a => (a.score ?? 1) < 1)
    .slice(0, AUDIT_LIMIT);

  const short = (url?: string) => url ? ' ' + pathOf(url, url) : '';

  const heaviest = [...(result.resources?.requests ?? [])]
    .sort((a, b) => b.transferSize - a.transferSize)
    .slice(0, 8)
    .map(r => `  ${r.resourceType}${short(r.url)} ${Math.round(r.transferSize / 1024)}KB starts ${Math.round(r.startTime)}ms ttfb ${Math.round(r.ttfb)}ms`)
    .join('\n');

  // The specifics that make advice about *this* page rather than about web performance:
  // which function blocked the thread, which element moved, which library is on board.
  // All of it is already in the result and none of it used to reach the model, which is
  // why every audit came back with the same few sentences about third-party scripts.
  //
  // A long task and a resource used to be two unrelated lists — attributeLongTasks
  // chains them: which script was this task actually running, directly (the trace
  // named it) or inferred (a script's download/execute window overlapped it). The
  // model gets to cite a specific file instead of a bare "250ms scripting task".
  const attributedTasks = attributeLongTasks(
    [...(result.flameChartData?.events ?? [])]
      .filter(e => e.isLongTask)
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 6)
      .map(e => ({ name: e.name, startMs: e.startMs, durationMs: e.durationMs, ...(e.url ? { url: e.url } : {}) })),
    (result.resources?.requests ?? []).map(r => ({
      url: r.url, resourceType: r.resourceType, transferSize: r.transferSize,
      startTime: r.startTime, endTime: r.endTime,
    })),
  );

  const longTasks = attributedTasks.map(t => {
    const base = `  ${Math.round(t.durationMs)}ms ${t.name} at ${Math.round(t.startMs)}ms`;
    if (!t.resource) return base;
    const size = `${Math.round(t.resource.transferSize / 1024)}KB`;
    return t.resource.direct
      ? `${base} —${short(t.resource.url)} (${size})`
      : `${base} — likely ${t.resource.resourceType}${short(t.resource.url)} (${size}), downloading/executing at this time`;
  }).join('\n');

  const shifts = (result.clsData?.elements ?? [])
    .filter(e => e.score > 0)
    .slice(0, 4)
    .map(e => `  ${e.score.toFixed(3)} ${e.selector}${e.rootCause ? ` (${e.rootCause})` : ''}`)
    .join('\n');

  const vendors = (result.thirdParty ?? [])
    .slice(0, 5)
    .map(t => `  ${t.name}: ${Math.round(t.blockingTime)}ms blocking, ${Math.round(t.transferSize / 1024)}KB over ${t.requestCount} requests`)
    .join('\n');

  // A vendor that costs this page something and also costs several of the user's OTHER
  // pages the same thing is not this page's problem — it's a tag-manager/governance
  // problem, and the fix is different (remove or replace the vendor once, not chase it
  // route by route).
  const sitewideVendors = otherRoutesVendors && otherRoutesVendors.length > 0
    ? findSitewideVendors(
        (result.thirdParty ?? []).map(t => ({ name: t.name, blockingTime: t.blockingTime })),
        otherRoutesVendors,
      )
    : [];
  const sitewideLines = sitewideVendors.length > 0
    ? `\nAlso weighing down other pages you track:\n${sitewideVendors.map(v => `  ${describeSitewideVendor(v)}`).join('\n')}\n`
    : '';

  const libraries = (result.resources?.detectedLibraries ?? []).map(l => l.name).join(', ');
  const s = result.scores;

  // A single Lighthouse run swings ±10+ points on the same page — CPU scheduling,
  // network jitter, ad-auction timing — a fact the model needs before it treats one
  // run's numbers, or a movement since a previous run, as settled rather than possibly
  // noise. Precise-mode audits (runs > 1) report the median and carry their own spread;
  // a Fast-mode audit is one sample and has to be described as one.
  const measurementNote = result.measurement && result.measurement.runs > 1
    ? (result.measurement.spread >= 15
        ? `\nThis is the median of ${result.measurement.runs} runs (Precise mode); those runs disagreed by ${Math.round(result.measurement.spread)} points — this page's own load behavior is genuinely unstable, not just measurement noise.\n`
        : `\nThis is the median of ${result.measurement.runs} runs (Precise mode, spread ${Math.round(result.measurement.spread)} points) — a reliable reading.\n`)
    : `\nThis was a single run (Fast mode) — Lighthouse scores can swing significantly run to run on the same page. Treat this as one sample, not a precise measurement; a Precise-mode audit (several runs, median reported) would confirm whether a number here is real movement or just this run's noise.\n`;

  // Not just "the score moved" but "moved because you shipped this" — the same
  // instinct as phase 1's audit details, applied to the comparison instead of the
  // single audit. Only computed when both sides actually have a resource list to
  // diff (an old stored run from before phase 1's fields existed still compares on
  // scores/metrics alone, same as before this existed).
  const changeSince = previous?.resources && result.resources
    ? (() => {
        const diff = diffResources(
          {
            requests: result.resources!.requests,
            detectedLibraries: result.resources!.detectedLibraries,
            thirdParty: result.thirdParty ?? [],
          },
          previous.resources,
        );
        if (!resourceDiffHasChanges(diff)) return '';

        const lines = formatResourceDiff(diff).map(l => `  ${l}`);
        return `\nWhat changed since that run:\n${lines.join('\n')}\n`;
      })()
    : '';

  // Lab (this Lighthouse run) vs field (real Chrome users, CrUX's trailing 28 days) —
  // sat next to each other on screen without either surface comparing them. A gap
  // usually means the audience's real devices/networks differ from Lighthouse's
  // throttling profile, not that either number is wrong.
  const fieldComparison = fieldData
    ? (() => {
        const gaps = compareLabAndField(
          { lcp: result.metrics.lcp, cls: result.metrics.cls, fcp: result.metrics.fcp },
          fieldData,
        );
        if (gaps.length === 0) return '';
        const lines = formatGapLines(gaps, {
          subject:  "real users'",
          audience: 'real users',
          tail: g => `, ${Math.round(g.poorShare * 100)}% of them in the "poor" bucket`,
        });
        return `\nReal users (CrUX, ${fieldData.collectedFrom} to ${fieldData.collectedTo}, ${fieldData.scope} scope) vs this lab run:\n${lines.join('\n')}\n`;
      })()
    : '';

  // Your own visitors, not the public Chrome sample — a second, independent field
  // reading, when this site has its own RUM snippet installed. `RumMetricSummary`
  // deliberately carries the same p75/bucket shape `CruxMetric` does (see
  // packages/shared/src/types/rum.ts), so the exact comparison logic CrUX uses above
  // runs unmodified here; only the label and the sample count differ.
  const rumComparison = rumData
    ? (() => {
        const asField = rumAsFieldData(rumData, result.url);
        const gaps = compareLabAndField(
          { lcp: result.metrics.lcp, cls: result.metrics.cls, fcp: result.metrics.fcp },
          asField,
        );
        if (gaps.length === 0) return '';
        const lines = formatGapLines(gaps, {
          subject:  "your own visitors'",
          audience: 'them',
          suffix: g => ` (${rumData.metrics[g.metric]?.samples ?? 0} samples)`,
        });
        return `\nYour own visitors (RUM, ${rumData.scope === 'path' ? 'this page' : 'site-wide'}, last 7 days, ${rumData.pageViews} page views) vs this lab run:\n${lines.join('\n')}\n`;
      })()
    : '';

  // From the Compare page, when this user has run one against this page's host —
  // reoriented to "you" vs "them" regardless of which side was `source` in that run.
  // Metrics/scores are a point-in-time snapshot from when Compare last ran, not this
  // audit's own numbers, so it's labelled with its own date rather than folded into
  // the numbers above as if they were fresh.
  const competitorComparison = competitor
    ? (() => {
        const fmtSide = (side: ComparisonSide) =>
          `perf ${side.scores['performance'] ?? '?'}, LCP ${fmtMs(side.metrics['lcp'] ?? 0)}, TBT ${fmtMs(side.metrics['tbt'] ?? 0)}, CLS ${(side.metrics['cls'] ?? 0).toFixed(3)}`;
        const verdictLine = competitor.aiVerdict ? `\n  ${competitor.aiVerdict}` : '';
        return `\nCompetitor comparison (vs ${competitor.competitorHostname}, compared ${competitor.comparedAt}, ${competitor.winner === 'tie' ? 'roughly tied' : competitor.winner === 'mine' ? 'you were faster' : 'they were faster'}):\n  You: ${fmtSide(competitor.mine)}\n  Them: ${fmtSide(competitor.theirs)}${verdictLine}\n`;
      })()
    : '';

  const context = `URL: ${result.url}
${measurementNote}${previous ? `Previous run (${previous.at}): performance ${previous.scores.performance}, LCP ${fmtMs(previous.metrics.lcp)}, TBT ${fmtMs(previous.metrics.tbt)}, CLS ${previous.metrics.cls.toFixed(3)}\n` : 'No earlier audit of this page to compare against.\n'}${changeSince}${fieldComparison}${rumComparison}${competitorComparison}Scores: performance ${s.performance}, accessibility ${s.accessibility}, best practices ${s.bestPractices}, SEO ${s.seo}
LCP ${fmtMs(result.metrics.lcp)}, TBT ${fmtMs(result.metrics.tbt)}, CLS ${result.metrics.cls.toFixed(3)}, FCP ${fmtMs(result.metrics.fcp)}, TTI ${fmtMs(result.metrics.tti)}
${result.resources ? `${result.resources.requests.length} requests, ${result.resources.thirdPartyRequests.length} of them third-party` : ''}
${libraries ? `Libraries on the page: ${libraries}` : ''}
${history && history.length > 0 ? `\nRecommendations given before on this page:\n${history.map(h => `  ${h.resolved ? '[now fixed] ' : `[${repeatTier(h.timesGiven)}, still open] `}${h.fix}`).join('\n')}\n` : ''}

Longest main-thread tasks:
${longTasks || '  (none over the long-task threshold)'}

Heaviest resources:
${heaviest || '  (none recorded)'}

Layout shifts:
${shifts || '  (none)'}

Third-party vendors:
${vendors || '  (none)'}
${sitewideLines}
Failing audits:
${failing.map(a => {
  const savings = [
    a.savingsMs    ? `~${a.savingsMs}ms`                              : null,
    a.savingsBytes ? `~${Math.round(a.savingsBytes / 1024)}KB` : null,
  ].filter(Boolean).join(', ');
  const head = `  ${a.id} — ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}${savings ? ` [potential savings: ${savings}]` : ''}`;
  const items = (a.details ?? []).map(d => {
    const bits = [
      d.selector,
      d.snippet && d.snippet !== d.selector ? d.snippet : undefined,
      d.url,
      d.value,
    ].filter(Boolean);
    return bits.length ? `    ${bits.join('  ')}` : null;
  }).filter((l): l is string => l !== null);
  return items.length ? `${head}\n${items.join('\n')}` : head;
}).join('\n') || '  (none)'}`;

  return { context, failing, poor, hasSitewideVendors: sitewideVendors.length > 0 };
}
