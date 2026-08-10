import { rateScore, rateVital, RATING_COLOR, type ScoreRating, type VitalKey } from '@perfscope/shared';

// Hex literals (not CSS vars) because callers derive alpha variants ("`${color}18`");
// the values are the shared RATING_COLOR palette, aliased for existing call sites.
export const SCORE_GOOD = RATING_COLOR.good;
export const SCORE_WARN = RATING_COLOR['needs-improvement'];
export const SCORE_BAD  = RATING_COLOR.poor;

/**
 * Compact display band used across client UI. Thresholds live in @perfscope/shared
 * (rateScore / rateVital) — never re-derive 90/50 or vitals limits locally.
 */
export type ScoreBand = 'good' | 'warn' | 'poor';

const RATING_TO_BAND: Record<ScoreRating, ScoreBand> = {
  good:                'good',
  'needs-improvement': 'warn',
  poor:                'poor',
};

export const scoreBand = (score: number): ScoreBand => RATING_TO_BAND[rateScore(score)];

export const vitalBand = (key: VitalKey, value: number): ScoreBand =>
  RATING_TO_BAND[rateVital(key, value)];

export function scoreColor(score: number): string {
  const band = scoreBand(score);
  return band === 'good' ? SCORE_GOOD : band === 'warn' ? SCORE_WARN : SCORE_BAD;
}
