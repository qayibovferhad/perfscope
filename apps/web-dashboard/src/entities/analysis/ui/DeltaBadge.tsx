import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { fmtDateTime } from '@/shared/lib/time';
import { deltaOf, type DeltaKind } from '../lib';

/**
 * How one number moved since the previous run of the same page.
 *
 * Renders nothing at all when there is no previous run — every caller can drop it in
 * unconditionally, and a first-ever audit shows exactly what it showed before this
 * existed. A movement under the shared noise floor is rendered *muted* rather than
 * hidden: the number did move, and a badge that vanished below a threshold would read as
 * "identical to last time", which is a stronger claim than the measurement supports.
 *
 * The arrow points the way the *value* went; the colour says whether that is good. For a
 * score, up is good; for every vital, down is. Colour and arrow are therefore independent,
 * which is also why the arrow alone is never the only signal — the sign is in the text.
 */
export function DeltaBadge({
  kind, curr, prev, format, since, className,
}: {
  kind: DeltaKind;
  curr: number;
  prev: number | undefined | null;
  /** Applied to the absolute change, in the metric's own unit. Defaults to a rounded integer. */
  format?: (n: number) => string;
  /** ISO timestamp of the compared-against run, for the tooltip. */
  since?: string;
  className?: string;
}) {
  const delta = deltaOf(kind, curr, prev);
  if (!delta) return null;

  const fmt = format ?? ((n: number) => String(Math.round(n)));
  const tone =
    !delta.meaningful || delta.direction === 'same' ? 'text-ld-text-3'
    : delta.direction === 'better'                  ? 'text-ld-score-good'
    :                                                 'text-ld-rose';

  const Icon = delta.direction === 'same' ? Minus : delta.diff > 0 ? ArrowUp : ArrowDown;
  const sign = delta.diff > 0 ? '+' : delta.diff < 0 ? '−' : '';

  const title = [
    delta.direction === 'same' ? 'Unchanged' : `${delta.direction === 'better' ? 'Better' : 'Worse'} than the previous run`,
    since ? `(${fmtDateTime(since)})` : null,
    delta.meaningful ? null : '— inside measurement noise',
  ].filter(Boolean).join(' ');

  return (
    <span
      title={title}
      className={cn('inline-flex items-center gap-[3px] font-mono text-[11.5px] font-semibold', tone, className)}
    >
      <Icon className="w-[11px] h-[11px]" aria-hidden />
      {delta.direction === 'same' ? '0' : `${sign}${fmt(Math.abs(delta.diff))}`}
    </span>
  );
}
