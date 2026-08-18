import {
  rateScore, rateVital, RATING_COLOR,
  type ScoreRating, type VitalKey, type TimelineFrame, type AnalysisResult, type AnalysisInsightsPayload,
} from '@perfscope/shared';

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

/**
 * Folds an `analysis:insights` payload onto the result it belongs to. Shared by the
 * analyzer's own socket hook and the compare page's — both attach the same `onInsights`
 * event, and the merge (insights text, per-resource advice, per-audit explanations, metric
 * notes, waterfall narrative) has to stay identical or the two surfaces would show a
 * differently-assembled result for the same underlying audit.
 */
export function mergeAnalysisInsights(prev: AnalysisResult, payload: AnalysisInsightsPayload): AnalysisResult {
  const next: AnalysisResult = { ...prev, aiInsights: payload.insights || prev.aiInsights };

  const advice = payload.advice;
  if (advice && next.resources) {
    next.resources = {
      ...next.resources,
      requests: next.resources.requests.map((r) =>
        advice[r.url] ? { ...r, advice: advice[r.url] } : r),
    };
  }

  const explanations = payload.auditExplanations;
  if (explanations) {
    next.audits = next.audits.map((a) =>
      explanations[a.id] ? { ...a, aiExplanation: explanations[a.id] } : a);
  }

  if (payload.metricNotes) next.aiMetricNotes = payload.metricNotes;
  if (payload.waterfall)   next.aiWaterfallNarrative = payload.waterfall;

  return next;
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
  warn: 'text-[var(--ld-amber)] border-[var(--ld-amber-line)] bg-[var(--ld-amber-soft)]',
  poor: 'text-[var(--ld-rose)] border-[var(--ld-rose-line)] bg-[var(--ld-rose-soft)]',
};

/** Border-only tint, for surfaces that bring their own background. Same tokens as BAND_TILE. */
export const BAND_BORDER: Record<ScoreBand, string> = {
  good: 'border-[var(--ld-accent-line)]',
  warn: 'border-[var(--ld-amber-line)]',
  poor: 'border-[var(--ld-rose-line)]',
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
