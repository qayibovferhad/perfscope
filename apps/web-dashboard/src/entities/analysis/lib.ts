import {
  rateScore, rateVital, RATING_COLOR,
  scoreVerdict, deltaPct, METRIC_NOISE, REGRESSION_PCT,
  type ScoreRating, type VitalKey, type TimelineFrame, type AnalysisResult, type AnalysisInsightsPayload,
  type AnalysisCategory, type CategoryPartial,
} from '@perfscope/shared';

/** One category's live result, keyed by category, as they stream in before the full
 *  audit completes — shared so both the analyzer's own hook and the compare page's
 *  (two independent audits, each streaming separately) render partials identically. */
export type PartialMap = Partial<Record<AnalysisCategory, CategoryPartial>>;

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

/**
 * Index of the frame closest to `ms` — for pinning a metric marker to a thumbnail,
 * where "at or before" (findFrameAt) would pick a stale frame when the next one is
 * nearer. Binary search: the waterfall calls this per axis tick and per scrub event.
 * Was copied verbatim into three components before it lived here.
 */
export function findClosestFrameIndex(frames: TimelineFrame[], targetMs: number): number {
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].timing < targetMs) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(frames[lo - 1].timing - targetMs) < Math.abs(frames[lo].timing - targetMs)) {
    return lo - 1;
  }
  return lo;
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

// ─── Movement against the previous run ────────────────────────────────────────

/** What kind of number is being compared — they disagree about which direction is good. */
export type DeltaKind = 'score' | VitalKey;

export interface Delta {
  /** Signed change in the metric's own unit (points, ms, or CLS units). */
  diff: number;
  /** Whether the change went the way the user wants, regardless of size. */
  direction: 'better' | 'worse' | 'same';
  /**
   * Whether the change clears the shared noise floor. A movement below it is still shown —
   * hiding it would make a page look frozen — but muted, because the honest reading of a
   * 3-point score change is "this is the measurement, not your site".
   */
  meaningful: boolean;
}

/**
 * The change from `prev` to `curr`, judged with the *same* thresholds the alerts use.
 *
 * Nothing here re-derives what counts as a real move: scores go through `scoreVerdict`
 * (10 points), lcp/tbt/cls through `METRIC_NOISE` + `REGRESSION_PCT` in both directions.
 * If a badge and a regression alert ever disagreed about the same pair of runs, the badge
 * would be the reason nobody trusts the alert.
 *
 * fcp/si/tti have no absolute floor in the shared table — nothing alerts on them, so none
 * was ever needed — so they are judged on the percentage alone. That is deliberately
 * stated here rather than fixed by inventing three more constants in the UI layer.
 */
export function deltaOf(kind: DeltaKind, curr: number, prev: number | undefined | null): Delta | null {
  if (prev === undefined || prev === null || !Number.isFinite(prev) || !Number.isFinite(curr)) return null;

  const diff = curr - prev;
  if (diff === 0) return { diff: 0, direction: 'same', meaningful: false };

  if (kind === 'score') {
    return {
      diff,
      direction: diff > 0 ? 'better' : 'worse',
      meaningful: scoreVerdict(curr, prev) !== 'stable',
    };
  }

  // Every vital is "worse when bigger".
  const direction = diff < 0 ? 'better' : 'worse';
  const pctClears = Math.abs(deltaPct(curr, prev)) > REGRESSION_PCT;
  const floor = kind in METRIC_NOISE ? METRIC_NOISE[kind as keyof typeof METRIC_NOISE] : 0;
  const meaningful = pctClears && Math.abs(diff) >= floor;

  return { diff, direction, meaningful };
}
