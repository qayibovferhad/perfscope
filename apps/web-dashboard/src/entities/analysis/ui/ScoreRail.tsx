import { scoreBand, BAND_BAR } from '../lib';

/**
 * A score placed on Lighthouse's own scale, rather than printed as a number.
 *
 * 83 and 91 are four points apart and on opposite sides of the only boundary anybody
 * acts on; read as numerals in a column they look like neighbours. The rail draws the
 * two thresholds — 50 and 90 — as the zones they are, and puts the site's marker in
 * one of them, so a row answers "is this good" before it is read.
 *
 * Lives in `entities/analysis` and not in `shared/ui`: the boundaries *are* the band
 * definition, and a second copy of 50/90 in a shared primitive is a second copy of the
 * product's central judgement.
 */
export function ScoreRail({
  score, previous, className,
}: {
  score: number | null;
  /** The run before this one, drawn as a hollow ghost — where the site was moving from. */
  previous?: number | null;
  className?: string;
}) {
  const band = score === null ? null : scoreBand(score);

  return (
    <div className={`min-w-[140px] ${className ?? ''}`}>
      <div
        className="relative h-[7px] rounded-full overflow-hidden bg-ld-surface-2 border border-ld-border"
        role="img"
        aria-label={score === null
          ? 'No score recorded'
          : `Score ${score} of 100 — ${band} (poor below 50, needs work below 90)`}
      >
        {/* The zones, at the widths the thresholds actually sit at: half the rail is the
            failing half. Washes, not fills — the marker has to be the thing you see. */}
        <span aria-hidden className="absolute inset-y-0 left-0 w-1/2 bg-ld-rose-wash" />
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-[40%] bg-ld-amber-wash" />
        <span aria-hidden className="absolute inset-y-0 left-[90%] right-0 bg-ld-accent-wash" />

        {/* Threshold ticks — the two numbers under the rail name these. */}
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-ld-border-strong" />
        <span aria-hidden className="absolute inset-y-0 left-[90%] w-px bg-ld-border-strong" />

        {previous != null && score !== null && (
          <span
            aria-hidden
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[7px] h-[7px] rounded-full border border-ld-border-strong bg-ld-surface"
            style={{ left: `${Math.max(0, Math.min(100, previous))}%` }}
          />
        )}

        {score !== null && band && (
          <span
            aria-hidden
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[3px] h-[13px] rounded-full ${BAND_BAR[band]}`}
            style={{ left: `${Math.max(0, Math.min(100, score))}%` }}
          />
        )}
      </div>

      {/* The scale's own numerals. Mono and tiny — they are the printing on the
          instrument, not data. */}
      <div aria-hidden className="relative h-[13px] mt-[3px] font-mono text-[9.5px] text-ld-text-3 tabular-nums">
        <span className="absolute left-0">0</span>
        <span className="absolute left-1/2 -translate-x-1/2">50</span>
        <span className="absolute left-[90%] -translate-x-1/2">90</span>
      </div>
    </div>
  );
}
