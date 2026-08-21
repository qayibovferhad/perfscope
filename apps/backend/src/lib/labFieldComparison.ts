/**
 * Lab vs field — the comparison CrUX data sat next to on screen without anyone, human or
 * model, actually comparing it. A Lighthouse run is one synthetic load on one simulated
 * connection; CrUX is real Chrome users over the trailing 28 days. They can legitimately
 * disagree, and the gap itself is a finding: a fast lab run next to a slow field p75
 * usually means the audience's real devices/networks are worse than Lighthouse's
 * throttling profile assumes, not that the lab number is wrong.
 */
import { fmtMetric } from '@perfscope/shared';
import type { CruxData, RumSummary } from '@perfscope/shared';

export interface LabFieldGap {
  metric:    'lcp' | 'cls' | 'fcp'
  labValue:  number
  fieldP75:  number
  /** fieldP75 - labValue. Positive means real users see it worse than this lab run did. */
  gap:       number
  /** Share of real-user samples in CrUX's 'poor' bucket, 0-1 — flags "this is bad for a
   *  lot of people", which a single p75 number can hide. */
  poorShare: number
}

/** Only the metrics both sides actually measure the same thing for. TBT has no clean
 *  field equivalent (INP is the closest real-world analogue but is a different metric,
 *  input-response rather than main-thread-blocking) and SI/TTI aren't in CrUX at all. */
const COMPARABLE = ['lcp', 'cls', 'fcp'] as const;

/** A gap has to be large enough, in both relative and absolute terms, to be worth a
 *  sentence — mirrors the thresholds `resourceDiff.ts` uses for the same reason. */
const GAP_MIN_RATIO = 0.25;

export function compareLabAndField(
  lab: { lcp: number; cls: number; fcp: number },
  field: CruxData,
): LabFieldGap[] {
  const out: LabFieldGap[] = [];
  for (const metric of COMPARABLE) {
    const m = field.metrics[metric];
    if (!m) continue;

    const labValue = lab[metric];
    const gap  = m.p75 - labValue;
    const base = Math.max(Math.abs(labValue), metric === 'cls' ? 0.01 : 1);
    if (Math.abs(gap) / base < GAP_MIN_RATIO) continue;

    out.push({ metric, labValue, fieldP75: m.p75, gap, poorShare: m.poor });
  }
  return out;
}

/**
 * `compareLabAndField`'s gaps as lines of prose for a model's context.
 *
 * Lives beside the function that produces the gaps because four near-identical copies
 * grew across ai.service and advice.service (CrUX and RUM each, twice) and had already
 * drifted in wording. `subject` owns the p75 ("real users'" / "your own visitors'"),
 * `audience` the worse/better clause; `suffix` and `tail` carry the per-source extras —
 * RUM's sample counts, CrUX's poor-bucket share.
 */
export function formatGapLines(gaps: LabFieldGap[], opts: {
  subject:  string;
  audience: string;
  /** Line prefix — two spaces inside a context block, "- " in an advisor list. */
  prefix?:  string;
  /** Appended right after the p75 value, e.g. " (12 samples)". */
  suffix?:  (g: LabFieldGap) => string;
  /** Appended at the end of the line, e.g. the poor-bucket share. */
  tail?:    (g: LabFieldGap) => string;
}): string[] {
  const { subject, audience, prefix = '  ', suffix, tail } = opts;
  return gaps.map(g =>
    `${prefix}${g.metric.toUpperCase()}: lab ${fmtMetric(g.metric, g.labValue)}, ${subject} p75 ${fmtMetric(g.metric, g.fieldP75)}${suffix?.(g) ?? ''} — ${g.gap > 0 ? 'worse' : 'better'} for ${audience}${tail?.(g) ?? ''}`);
}

/**
 * Lets `compareLabAndField` run unmodified against RUM data too. `RumMetricSummary` is
 * deliberately shaped as `CruxMetric` plus a sample count (see
 * packages/shared/src/types/rum.ts) specifically so the two sources can share this kind of
 * logic instead of a second, parallel comparison function that could drift from this one.
 */
export function rumAsFieldData(rum: RumSummary, url: string): CruxData {
  return {
    scope:         rum.scope === 'path' ? 'url' : 'origin',
    url,
    formFactor:    rum.device === 'mobile' ? 'mobile' : 'desktop',
    collectedFrom: rum.from.slice(0, 10),
    collectedTo:   rum.to.slice(0, 10),
    metrics:       rum.metrics,
  };
}
