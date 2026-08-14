import { Play, Pause, Clock } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Scrubber } from '@/shared/ui/scrubber';

/**
 * Play/pause, scrubber and elapsed readout for the two playback comparisons.
 *
 * The waterfall and the filmstrip carried byte-identical copies of all three, differing
 * only in the seek callback's name and how the time is formatted. Both also hand-drew the
 * scrubber rather than using the shared one, and their copies had drifted: no
 * `::-webkit-slider-thumb` / `::-moz-range-thumb` suppression, a `bg-white` thumb that
 * ignores the theme, and no clamp on the fill percentage.
 *
 * `format` is a prop because the two genuinely differ: a waterfall is read in
 * milliseconds, a filmstrip in seconds.
 */
export function TransportBar({
  isPlaying, onTogglePlay, currentMs, totalMs, onSeek, format, className,
}: {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentMs: number;
  totalMs: number;
  onSeek: (ms: number) => void;
  format: (ms: number) => string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Button
        variant="outline"
        size="icon-round"
        onClick={onTogglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className={cn(
          'shrink-0',
          isPlaying
            ? 'bg-ld-accent border-ld-accent shadow-[0_0_12px_var(--ld-accent-soft)] hover:bg-ld-accent'
            : 'bg-ld-surface-2 border-ld-border',
        )}
      >
        {isPlaying
          ? <Pause className="w-3 h-3 text-white" />
          : <Play  className="w-3 h-3 text-ld-text-3" />}
      </Button>

      {/* 16ms ≈ one frame at 60fps; finer steps only add re-renders nobody can see. */}
      <Scrubber value={currentMs} max={totalMs} onChange={onSeek} step={16} />

      <div className="flex items-center gap-1 shrink-0">
        <Clock className="w-3 h-3 text-ld-text-3" />
        <span className="font-mono text-[11px] tabular-nums text-ld-text-2">{format(currentMs)}</span>
        <span className="text-[10px] text-ld-text-3">/ {format(totalMs)}</span>
      </div>
    </div>
  );
}
