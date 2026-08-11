import { rateVital, rateCls, type ScoreRating } from '@/entities/analysis';
import { fmtMs, fmtCls } from '@/shared/lib/format';
import type { CruxMetricKey } from '@perfscope/shared';

/**
 * Thresholds for the two field metrics @perfscope/shared has no helper for.
 * Values are Google's published field limits (web.dev/inp, web.dev/ttfb).
 */
const rateBy = (good: number, poor: number) => (value: number): ScoreRating =>
  value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor';

interface CruxMetricMeta {
  label:  string;
  title:  string;
  format: (value: number) => string;
  rate:   (value: number) => ScoreRating;
}

export const CRUX_METRICS: Record<CruxMetricKey, CruxMetricMeta> = {
  lcp:  { label: 'LCP',  title: 'Largest Contentful Paint',  format: fmtMs,  rate: (v) => rateVital('lcp', v) },
  inp:  { label: 'INP',  title: 'Interaction to Next Paint', format: fmtMs,  rate: rateBy(200, 500) },
  cls:  { label: 'CLS',  title: 'Cumulative Layout Shift',   format: fmtCls, rate: rateCls },
  fcp:  { label: 'FCP',  title: 'First Contentful Paint',    format: fmtMs,  rate: (v) => rateVital('fcp', v) },
  ttfb: { label: 'TTFB', title: 'Time to First Byte',        format: fmtMs,  rate: rateBy(800, 1800) },
};

/** Core Web Vitals first, then the supporting diagnostics. */
export const CRUX_METRIC_ORDER: CruxMetricKey[] = ['lcp', 'inp', 'cls', 'fcp', 'ttfb'];

export const RATING_TEXT: Record<ScoreRating, string> = {
  good:                'text-ld-accent',
  'needs-improvement': 'text-ld-amber',
  poor:                'text-ld-rose',
};

export const RATING_LABEL: Record<ScoreRating, string> = {
  good:                'Good',
  'needs-improvement': 'Needs improvement',
  poor:                'Poor',
};

/** "2024-01-01" → "1 Jan 2024"; empty input stays empty so callers can skip the meta line. */
export function fmtCollectionDate(iso: string): string {
  if (!iso) return '';
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
