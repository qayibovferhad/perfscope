import { Trophy } from 'lucide-react';
import { CompareSection } from './CompareSection';
import { Skeleton } from '@/shared/ui/skeleton';

/**
 * Same shape as `ComparisonScoreboard` — two gauges, a center diff column, five metric
 * rows — shown while neither side has a `performance`-category result yet. Matching the
 * real widget's layout (not a generic score-card grid) means the moment real numbers
 * arrive, the page doesn't jump to a different shape; it just fills in.
 */
export function ComparisonScoreboardSkeleton() {
  return (
    <CompareSection icon={<Trophy />} title="Performance Scoreboard" animate={false}>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-5 items-center max-[760px]:grid-cols-1 mb-[28px]">
        <div className="text-center">
          <Skeleton className="w-[168px] h-[168px] rounded-full mx-auto mb-[14px]" />
          <div className="text-[15px] font-bold text-ld-text">Your Site</div>
          <Skeleton className="h-5 w-24 rounded-full mx-auto mt-[10px]" />
        </div>

        <div className="text-center px-[12px] max-[760px]:order-first max-[760px]:py-4">
          <div className="font-mono text-[10px] tracking-[.14em] uppercase text-ld-text-3 mb-2">
            Points diff
          </div>
          <Skeleton className="h-[42px] w-[54px] mx-auto mb-[14px]" />
          <div className="w-[44px] h-[44px] rounded-full grid place-items-center mx-auto font-mono text-[13px] font-bold text-ld-text-3 border border-ld-border-strong bg-ld-surface-2">
            VS
          </div>
        </div>

        <div className="text-center">
          <Skeleton className="w-[168px] h-[168px] rounded-full mx-auto mb-[14px]" />
          <div className="text-[15px] font-bold text-ld-text">Competitor</div>
          <Skeleton className="h-5 w-24 rounded-full mx-auto mt-[10px]" />
        </div>
      </div>

      <div className="grid grid-cols-[110px_54px_1fr_54px_90px] gap-x-3 pb-[8px] mb-[2px] max-[760px]:grid-cols-[80px_auto_1fr_auto]">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em] text-ld-text-3">Metric</span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em] text-ld-accent-2 text-right">You</span>
        <div />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em] text-ld-amber">Rival</span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em] text-ld-text-3 text-right max-[760px]:hidden">Status</span>
      </div>

      <div>
        {['LCP', 'FCP', 'TBT', 'SI', 'CLS'].map((abbr) => (
          <div
            key={abbr}
            className="grid items-center gap-x-3 py-[11px] border-b border-ld-border last:border-b-0
              grid-cols-[110px_54px_1fr_54px_90px] max-[760px]:grid-cols-[80px_auto_1fr_auto]"
          >
            <b className="font-mono text-[13px] font-semibold text-ld-text">{abbr}</b>
            <Skeleton className="h-3 w-10 ml-auto" />
            <Skeleton className="h-[10px] w-full rounded-[5px]" />
            <Skeleton className="h-3 w-10" />
            <div className="flex justify-end max-[760px]:hidden">
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </CompareSection>
  );
}
