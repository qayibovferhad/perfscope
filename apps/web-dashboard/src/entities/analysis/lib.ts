import { rateScore, rateVital, RATING_COLOR, type ScoreRating, type VitalKey, type TimelineFrame } from '@perfscope/shared';

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

/** Last filmstrip frame at or before `ms` — the frame a scrubber position shows. */
export function findFrameAt(frames: TimelineFrame[], ms: number): TimelineFrame {
  let best: TimelineFrame = frames[0] ?? { timing: 0, data: '' };
  for (const f of frames) {
    if (f.timing <= ms) best = f;
    else break;
  }
  return best;
}

// ─── Band → Tailwind class maps ───────────────────────────────────────────────
// The single source for colouring anything by band. Before these existed the same
// triple was re-typed in 13 components and had already drifted (text-ld-accent vs
// text-ld-accent-2 vs text-ld-score-good for the same "good"). Add a map here rather
// than writing a band ternary in a component.

/** Score/metric value text. `ld-score-good` resolves per theme (accent-2 dark, accent light). */
export const BAND_TEXT: Record<ScoreBand, string> = {
  good: 'text-ld-score-good',
  warn: 'text-ld-amber',
  poor: 'text-ld-rose',
};

/** SVG ring/arc strokes. */
export const BAND_STROKE: Record<ScoreBand, string> = {
  good: '[stroke:var(--ld-accent)]',
  warn: '[stroke:var(--ld-amber)]',
  poor: '[stroke:var(--ld-rose)]',
};

/** Tinted icon tile (text + border + soft background). */
export const BAND_TILE: Record<ScoreBand, string> = {
  good: 'text-[var(--ld-accent)] border-[var(--ld-accent-line)] bg-[var(--ld-accent-soft)]',
  warn: 'text-[var(--ld-amber)] border-[rgba(230,162,60,.3)] bg-[rgba(230,162,60,.1)]',
  poor: 'text-[var(--ld-rose)] border-[rgba(242,100,122,.3)] bg-[rgba(242,100,122,.08)]',
};

/** Border-only tint, for surfaces that bring their own background. Same values as BAND_TILE. */
export const BAND_BORDER: Record<ScoreBand, string> = {
  good: 'border-[var(--ld-accent-line)]',
  warn: 'border-[rgba(230,162,60,.3)]',
  poor: 'border-[rgba(242,100,122,.3)]',
};

/** Solid fills — progress bars, dots. */
export const BAND_BAR: Record<ScoreBand, string> = {
  good: 'bg-ld-accent',
  warn: 'bg-ld-amber',
  poor: 'bg-ld-rose',
};

/** Human label per band; same wording as the field-data RATING_LABEL. */
export const BAND_LABEL: Record<ScoreBand, string> = {
  good: 'Good',
  warn: 'Needs improvement',
  poor: 'Poor',
};
