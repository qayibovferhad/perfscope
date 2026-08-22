import { useEffect, useState } from 'react';

/**
 * How long the audit in flight has been going.
 *
 * A Lighthouse audit is 20 seconds on a light page and can pass a minute on a heavy one
 * measured several times — long enough that a progress bar alone reads as "stuck". A
 * clock that is visibly moving is the difference between waiting and wondering.
 *
 * Counts from `startedAt` rather than from mount, so re-rendering the panel (a partial
 * score arriving, a stage changing) cannot reset it back to zero.
 */
/** `m:ss`, the one format an audit's duration is written in — live or finished. */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function ElapsedClock({ startedAt, className }: { startedAt: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  // One interval for the life of the component; `startedAt` is read at render, so a new
  // run's clock corrects itself on the next tick rather than needing a resync here.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const label = formatElapsed(now - startedAt);

  return (
    <span
      className={className}
      // Announced as one value on change rather than digit by digit — a screen reader
      // reciting every tick would be unusable.
      aria-label={`Elapsed ${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds`}
    >
      {label}
    </span>
  );
}
