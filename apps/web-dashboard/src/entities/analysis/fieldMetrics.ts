import { rateVital, type ScoreRating } from '@perfscope/shared';
import { fmtMs, fmtCls } from '@/shared/lib/format';

/**
 * How the five field metrics are labelled, formatted and graded.
 *
 * Shared by every view of real-user data — CrUX (public Chrome users) and RUM (the
 * site's own visitors) grade on identical thresholds, so the two must not each carry
 * their own copy or a panel could call the same number "good" and "poor".
 */

export type FieldMetricKey = 'lcp' | 'inp' | 'cls' | 'fcp' | 'ttfb';

interface FieldMetricMeta {
  label:  string;
  title:  string;
  format: (value: number) => string;
  rate:   (value: number) => ScoreRating;
}

export const FIELD_METRICS: Record<FieldMetricKey, FieldMetricMeta> = {
  lcp:  { label: 'LCP',  title: 'Largest Contentful Paint',  format: fmtMs,  rate: (v) => rateVital('lcp',  v) },
  inp:  { label: 'INP',  title: 'Interaction to Next Paint', format: fmtMs,  rate: (v) => rateVital('inp',  v) },
  cls:  { label: 'CLS',  title: 'Cumulative Layout Shift',   format: fmtCls, rate: (v) => rateVital('cls',  v) },
  fcp:  { label: 'FCP',  title: 'First Contentful Paint',    format: fmtMs,  rate: (v) => rateVital('fcp',  v) },
  ttfb: { label: 'TTFB', title: 'Time to First Byte',        format: fmtMs,  rate: (v) => rateVital('ttfb', v) },
};

/** Core Web Vitals first, then the supporting diagnostics. */
export const FIELD_METRIC_ORDER: FieldMetricKey[] = ['lcp', 'inp', 'cls', 'fcp', 'ttfb'];

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
