import { scoreBand } from '../lib';

/**
 * The average-performance pill a site header carries. One component, not one per page:
 * the project and scheduled pages each held a copy, and the project page's had grown a
 * `[data-theme=light]_:` class — not a valid Tailwind variant, silently doing nothing.
 */
export function AvgBadge({ score }: { score: number }) {
  const band = scoreBand(score);
  const cls = band === 'good'
    ? 'text-ld-accent-2 border-ld-accent-line bg-ld-accent-soft'
    : band === 'warn'
    ? 'text-ld-amber border-ld-amber-line bg-ld-amber-soft'
    : 'text-ld-rose border-ld-rose-line bg-ld-rose-soft';

  return (
    <span className={`inline-flex items-center gap-[8px] text-[13px] font-semibold px-[14px] py-[8px] rounded-full border ${cls}`}>
      <b className="font-mono font-bold">{score}</b>
      Avg performance
    </span>
  );
}
