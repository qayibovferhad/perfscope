import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { MetricsGrid } from './MetricsGrid';
import type { PartialMap } from '../hooks/useAnalysis';

export function StreamingMetrics({ partials }: { partials: PartialMap }) {
  const metrics = partials['performance']?.metrics;
  return metrics ? (
    <MetricsGrid metrics={metrics} />
  ) : (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="border-border">
          <CardContent className="pt-4 pb-4 space-y-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
