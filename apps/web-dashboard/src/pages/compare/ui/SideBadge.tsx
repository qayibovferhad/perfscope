import { cn } from '@/shared/lib/utils';
import { SIDE_TEXT, SIDE_DOT, SIDE_LABEL, type CompareSide } from './sides';

/** Dot plus label — the header every comparison panel puts above its own column. */
export function SideBadge({ side, className }: { side: CompareSide; className?: string }) {
  return (
    <div className={cn(
      'flex items-center gap-[9px] font-mono text-[12px] font-semibold tracking-[.08em] uppercase',
      SIDE_TEXT[side],
      className,
    )}>
      <span className={cn('w-[9px] h-[9px] rounded-full shrink-0', SIDE_DOT[side])} />
      {SIDE_LABEL[side]}
    </div>
  );
}
