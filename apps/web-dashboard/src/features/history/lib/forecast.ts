/**
 * Turns a URL's audit history into the rows the trend-forecast panel renders.
 *
 * The maths lives in @perfscope/shared (`forecastMetric`); everything here is
 * presentation: which metrics to project, how each one reads in its own unit, and
 * the one honest sentence that describes it.
 */

import { forecastMetric, type ForecastMetric, type MetricForecast } from '@perfscope/shared';
import { hasResult, type HistoryEntry } from '@/entities/history';
import type { Website } from '@/entities/website';
import { fmtMs, fmtCls } from '@/shared/lib/format';

type Budgets = Website['budgets'];

/** A line through two points is not a trend; `forecastMetric` enforces the same floor. */
export const MIN_FORECAST_ENTRIES = 3;

const METRICS = ['performance', 'lcp', 'tbt', 'cls'] as const;

const LABEL: Record<ForecastMetric, string> = {
  performance: 'Performance',
  lcp:         'LCP',
  tbt:         'TBT',
  cls:         'CLS',
};

/** Latest value in the metric's own unit. */
const fmtValue: Record<ForecastMetric, (v: number) => string> = {
  performance: v => `${Math.round(v)}`,
  lcp:         fmtMs,
  tbt:         fmtMs,
  cls:         fmtCls,
};

/** Magnitude of a per-day change; scores read as points, the rest in their unit. */
const fmtRate: Record<ForecastMetric, (v: number) => string> = {
  performance: v => `${v.toFixed(1)} pts`,
  lcp:         fmtMs,
  tbt:         fmtMs,
  cls:         fmtCls,
};

const valueOf = (entry: HistoryEntry, metric: ForecastMetric): number =>
  metric === 'performance' ? entry.scores.performance : entry.metrics[metric];

/** A performance budget is a floor to stay above; every other budget is a ceiling. */
const isBreaching = (metric: ForecastMetric, value: number, budget: number): boolean =>
  metric === 'performance' ? value < budget : value > budget;

export type ForecastTone = 'good' | 'bad' | 'neutral';

export interface ForecastRow {
  key:      ForecastMetric;
  label:    string;
  forecast: MetricForecast;
  /** Latest value, formatted. */
  current:  string;
  /** One sentence the user can act on — never invents a number it cannot support. */
  sentence: string;
  tone:     ForecastTone;
}

function daysPhrase(days: number): string {
  if (days < 1) return 'under a day';
  const whole = Math.round(days);
  return `~${whole} day${whole === 1 ? '' : 's'}`;
}

function describe(
  metric: ForecastMetric,
  forecast: MetricForecast,
  budget: number | null,
): { sentence: string; tone: ForecastTone } {
  const label = LABEL[metric];
  const value = fmtValue[metric];

  // Too little signal to project. Say so rather than dressing noise up as a number.
  if (forecast.confidence === 'low') {
    return {
      sentence: `Trend isn't clear yet — ${forecast.sampleCount} runs still scatter too much to project.`,
      tone:     'neutral',
    };
  }

  if (forecast.direction === 'flat') {
    return { sentence: `Holding steady around ${value(forecast.current)}.`, tone: 'neutral' };
  }

  const verb = forecast.slopePerDay > 0 ? 'rising' : 'falling';
  const rate = fmtRate[metric](Math.abs(forecast.slopePerDay));
  const head = `${label} is ${verb} ~${rate}/day`;
  const tone: ForecastTone = forecast.direction === 'worsening' ? 'bad' : 'good';

  if (budget !== null && isBreaching(metric, forecast.current, budget)) {
    const still = forecast.direction === 'improving' ? 'still' : 'already';
    return { sentence: `${head} — ${still} past the ${value(budget)} budget.`, tone };
  }

  if (forecast.daysToBudget !== null && budget !== null) {
    return {
      sentence: `${head} — crosses ${value(budget)} in ${daysPhrase(forecast.daysToBudget)}.`,
      tone,
    };
  }

  return { sentence: `${head}.`, tone };
}

/**
 * One row per metric that produced a usable fit. Failed runs (all-zero audits) are
 * dropped first: a crashed Chrome is not a 0ms LCP and would drag every line with it.
 */
export function buildForecastRows(entries: HistoryEntry[], budgets?: Budgets): ForecastRow[] {
  const usable = entries.filter(hasResult);
  if (usable.length < MIN_FORECAST_ENTRIES) return [];

  const rows: ForecastRow[] = [];

  for (const key of METRICS) {
    const budget   = budgets?.[key] ?? null;
    const samples  = usable.map(e => ({ at: e.timestamp, value: valueOf(e, key) }));
    const forecast = forecastMetric(key, samples, budget);
    if (!forecast) continue;

    rows.push({
      key,
      label:   LABEL[key],
      forecast,
      current: fmtValue[key](forecast.current),
      ...describe(key, forecast, budget),
    });
  }

  return rows;
}

/** Calendar days between the oldest and newest usable run — the fit's actual window. */
export function trackedDays(entries: HistoryEntry[]): number {
  const times = entries.filter(hasResult).map(e => Date.parse(e.timestamp)).filter(Number.isFinite);
  if (times.length < 2) return 0;
  return Math.round((Math.max(...times) - Math.min(...times)) / 86_400_000);
}
