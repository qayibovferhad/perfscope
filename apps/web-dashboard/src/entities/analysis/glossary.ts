import { VITAL_THRESHOLDS, SCORE_BANDS, type VitalKey } from '@perfscope/shared';
import { fmtSec, fmtMs } from '@/shared/lib/format';

/**
 * What every score and metric in the dashboard means, in one place.
 *
 * A number without an explanation teaches nothing — "LCP 4.9s" only becomes actionable
 * once the reader knows what LCP measures and that 4.9s is bad. The same metric appears
 * in the analyzer, the compare view, CrUX and RUM, so the wording lives here rather than
 * being retyped at each of them.
 */

/** Lighthouse categories. Slugs, not display strings, so copy can change independently. */
export type CategoryKey = 'performance' | 'accessibility' | 'best-practices' | 'seo';
export type GlossaryKey = CategoryKey | VitalKey;

interface GlossaryEntry {
  /** Full name, e.g. "Largest Contentful Paint". */
  title:    string;
  /** One sentence: what the number is. */
  measures: string;
  /** One sentence: what a bad value costs — not a restatement of the name. */
  matters:  string;
}

export const GLOSSARY: Record<GlossaryKey, GlossaryEntry> = {
  // ── Lighthouse categories ──────────────────────────────────────────────────
  performance: {
    title:    'Performance',
    measures: 'A weighted blend of the loading and responsiveness metrics for this run.',
    matters:  'Every second of delay costs visitors before they have seen anything at all.',
  },
  accessibility: {
    title:    'Accessibility',
    measures: 'Automated checks for contrast, labels, roles and keyboard reachability.',
    matters:  'Failures lock out people using screen readers or keyboards, and carry legal risk.',
  },
  'best-practices': {
    title:    'Best Practices',
    measures: 'Security, deprecated APIs, console errors and general web hygiene.',
    matters:  'These are the defects that break silently later, on a browser you did not test.',
  },
  seo: {
    title:    'SEO',
    measures: 'Whether a search engine can crawl, read and index the page.',
    matters:  'A page that cannot be indexed cannot be found, however fast it loads.',
  },

  // ── Metrics ────────────────────────────────────────────────────────────────
  lcp: {
    title:    'Largest Contentful Paint',
    measures: 'When the biggest element in view finished rendering.',
    matters:  'It is the moment the page looks loaded — until then the visitor is waiting.',
  },
  fcp: {
    title:    'First Contentful Paint',
    measures: 'When the first text or image appeared.',
    matters:  'The first sign of life; a blank screen before it reads as a broken site.',
  },
  cls: {
    title:    'Cumulative Layout Shift',
    measures: 'How much content moved on its own while the page settled.',
    matters:  'Shifting layout makes people misclick and lose their place mid-read.',
  },
  tbt: {
    title:    'Total Blocking Time',
    measures: 'How long the main thread was too busy to respond to input.',
    matters:  'The lab stand-in for responsiveness: high TBT is a page that ignores clicks.',
  },
  inp: {
    title:    'Interaction to Next Paint',
    measures: 'How long the page took to visibly respond to a real interaction.',
    matters:  'This is sluggishness as the visitor feels it — only real users can produce it.',
  },
  ttfb: {
    title:    'Time to First Byte',
    measures: 'How long the server took to send the first byte of the response.',
    matters:  'Every later metric starts here, so a slow server caps how fast the page can be.',
  },
  si: {
    title:    'Speed Index',
    measures: 'How quickly the visible area filled in, averaged over the load.',
    matters:  'Catches a page that paints something early but keeps rearranging for seconds.',
  },
  tti: {
    title:    'Time to Interactive',
    measures: 'When the page became reliably able to handle input.',
    matters:  'Before it, a page that looks ready quietly drops taps and keystrokes.',
  },
};

/**
 * Thresholds are formatted per metric: seconds read better for paint timings, raw
 * milliseconds for the latency ones, and CLS is a bare ratio (fmtCls would print 0.1 as
 * "0.100", which reads like precision that is not there).
 */
const THRESHOLD_FMT: Record<VitalKey, (n: number) => string> = {
  fcp: fmtSec, lcp: fmtSec, si: fmtSec, tti: fmtSec,
  tbt: fmtMs,  inp: fmtMs,  ttfb: fmtMs,
  cls: (n) => String(n),
};

/** "Good ≤ 2.5s · Poor > 4.0s", read from VITAL_THRESHOLDS rather than retyped. */
export function thresholdLine(key: VitalKey): string {
  const { good, poor } = VITAL_THRESHOLDS[key];
  const fmt = THRESHOLD_FMT[key];
  return `Good ≤ ${fmt(good)} · Poor > ${fmt(poor)}`;
}

/** The short form shown inline beside a metric, e.g. "good ≤ 2.5s". */
export function goodThreshold(key: VitalKey): string {
  return `good ≤ ${THRESHOLD_FMT[key](VITAL_THRESHOLDS[key].good)}`;
}

/** The category equivalent, from SCORE_BANDS. */
export const CATEGORY_BAND_LINE =
  `Good ≥ ${SCORE_BANDS.good} · Poor < ${SCORE_BANDS.needsImprovement}`;

export const isVitalKey = (key: GlossaryKey): key is VitalKey => key in VITAL_THRESHOLDS;
