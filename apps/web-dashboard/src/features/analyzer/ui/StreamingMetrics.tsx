import { Skeleton } from '@/shared/ui/skeleton';
import { MetricsGrid } from '@/entities/analysis/ui/MetricsGrid';
import type { PartialMap } from '../model/useAnalysis';

function VitalSkeleton() {
  return (
    <div className="rounded-[14px] border border-ld-border bg-ld-surface p-[18px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="w-[28px] h-[28px] rounded-[8px]" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-2.5 w-16" />
      </div>
      <Skeleton className="h-7 w-20 mt-1" />
      <Skeleton className="h-2.5 w-36 mt-2" />
      <Skeleton className="h-1 w-full mt-[14px] rounded-[3px]" />
    </div>
  );
}

export function StreamingMetrics({ partials }: { partials: PartialMap }) {
  const metrics = partials['performance']?.metrics;
  return metrics ? (
    <MetricsGrid metrics={metrics} />
  ) : (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[14px]">
      {Array.from({ length: 6 }).map((_, i) => <VitalSkeleton key={i} />)}
    </div>
  );
}
