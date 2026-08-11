import { FIELD_METRICS, FIELD_METRIC_ORDER, RATING_TEXT, RATING_LABEL } from '@/entities/analysis';
import type { CruxMetricKey } from '@perfscope/shared';

/**
 * CrUX and RUM grade on the same thresholds, so the metadata lives in the analysis
 * entity and both field views read it from there.
 */
export const CRUX_METRICS = FIELD_METRICS as Record<CruxMetricKey, (typeof FIELD_METRICS)[keyof typeof FIELD_METRICS]>;
export const CRUX_METRIC_ORDER = FIELD_METRIC_ORDER as CruxMetricKey[];
export { RATING_TEXT, RATING_LABEL };

/** "2024-01-01" → "1 Jan 2024"; empty input stays empty so callers can skip the meta line. */
export function fmtCollectionDate(iso: string): string {
  if (!iso) return '';
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
