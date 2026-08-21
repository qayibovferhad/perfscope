import { Lightbulb } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

/**
 * The "Senior Insight" callout — a lightbulb, the eyebrow, one paragraph of judgement.
 * Shared because the history deep-dive and the compare-history report each had a copy,
 * already drifted on radius, icon size and type scale.
 */
export function InsightCard({ children, className }: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-[12px] px-[18px] py-[16px] rounded-[16px] bg-ld-surface-2 border border-ld-border', className)}>
      <span className="text-ld-accent shrink-0 mt-[1px]">
        <Lightbulb className="w-[19px] h-[19px]" />
      </span>
      <div>
        <div className="font-mono text-[10px] tracking-[.12em] uppercase text-ld-accent font-semibold mb-[6px]">
          Senior Insight
        </div>
        <p className="text-[14px] text-ld-text-2 leading-[1.55]">{children}</p>
      </div>
    </div>
  );
}
