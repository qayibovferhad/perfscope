import { cn } from '@/shared/lib/utils';

/**
 * Timeline scrubber: a range input with a gradient-filled track and a floating thumb.
 *
 * Shared because five near-identical copies grew across the analyzer and compare pages,
 * each hand-drawing the same thumb. The native thumb is suppressed and replaced with a
 * positioned div so the control looks identical across engines.
 */
export function Scrubber({
  value, max, onChange, step = 1, color = 'var(--ld-accent)', className,
  label = 'Scrub the timeline',
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  /** Granularity. The playback scrubbers use 16 — roughly one frame at 60fps. */
  step?: number;
  /** CSS color of the filled track and thumb ring — e.g. `var(--ld-rose)` for the CLS view. */
  color?: string;
  /**
   * Accessible name. The native thumb and track are suppressed and redrawn, so there is
   * never visible text beside this control for a label to point at — every copy of it was
   * an unnamed slider.
   */
  label?: string;
  className?: string;
}) {
  const pct = `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%`;
  return (
    <div className={cn('relative flex-1 min-w-0', className)}>
      <input
        type="range"
        aria-label={label}
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={cn(
          'w-full appearance-none h-[6px] rounded-full outline-none cursor-pointer block',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[14px] [&::-webkit-slider-thumb]:h-[14px] [&::-webkit-slider-thumb]:opacity-0',
          '[&::-moz-range-thumb]:w-[14px] [&::-moz-range-thumb]:h-[14px] [&::-moz-range-thumb]:opacity-0 [&::-moz-range-thumb]:border-none',
        )}
        style={{ background: `linear-gradient(to right, ${color} ${pct}, var(--ld-border) ${pct})` }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[14px] h-[14px] rounded-full bg-ld-surface border-2 pointer-events-none transition-[left] duration-75"
        style={{ left: pct, borderColor: color }}
      />
    </div>
  );
}
