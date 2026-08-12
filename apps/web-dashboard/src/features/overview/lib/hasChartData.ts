import type { OverviewActivityPoint, OverviewSiteTrend, OverviewVitalSplit } from '@perfscope/shared';

/**
 * Whether each dashboard chart has anything to draw.
 *
 * The charts pin their panels to a fixed height so the ones sharing a row line up. That is
 * right when there are lines and bars in them and wrong the moment there are not: a new
 * account would get a screen of tall empty boxes. The page asks these before fixing a
 * height, and each chart uses the same predicate for its own "nothing yet" copy, so the
 * two can't disagree about which state is on screen.
 */

export function hasTrendData(trend: OverviewSiteTrend[]): boolean {
  return trend.some(site => site.points.some(point => point.score !== null));
}

export function hasVitalsData(vitals: OverviewVitalSplit[]): boolean {
  return vitals.some(row => row.good + row.needsImprovement + row.poor > 0);
}

export function hasActivityData(activity: OverviewActivityPoint[]): boolean {
  return activity.some(day => day.audits > 0);
}
