import { Clock, Maximize2, Layers, LayoutGrid, Zap, Timer } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { cn } from '@/lib/utils';
import type { CoreWebVitals } from '../types';

const METRICS = [
  { key: 'fcp' as const, abbr: 'FCP', label: 'First Contentful Paint',   icon: Clock,      fmt: ms,  good: (v: number) => v < 1800, hint: '< 1.8s'  },
  { key: 'lcp' as const, abbr: 'LCP', label: 'Largest Contentful Paint', icon: Maximize2,  fmt: ms,  good: (v: number) => v < 2500, hint: '< 2.5s'  },
  { key: 'tbt' as const, abbr: 'TBT', label: 'Total Blocking Time',      icon: Layers,     fmt: (v: number) => `${Math.round(v)}ms`, good: (v: number) => v < 200,  hint: '< 200ms' },
  { key: 'cls' as const, abbr: 'CLS', label: 'Cumulative Layout Shift',  icon: LayoutGrid, fmt: (v: number) => v.toFixed(3), good: (v: number) => v < 0.1,  hint: '< 0.1'   },
  { key: 'si'  as const, abbr: 'SI',  label: 'Speed Index',              icon: Zap,        fmt: ms,  good: (v: number) => v < 3400, hint: '< 3.4s'  },
  { key: 'tti' as const, abbr: 'TTI', label: 'Time to Interactive',      icon: Timer,      fmt: ms,  good: (v: number) => v < 3800, hint: '< 3.8s'  },
];

function ms(v: number) { return `${(v / 1000).toFixed(1)}s`; }

export function MetricsGrid({ metrics }: { metrics: CoreWebVitals }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {METRICS.map(({ key, abbr, label, icon: Icon, fmt, good, hint }) => {
        const value = metrics[key];
        const isGood = good(value);
        return (
          <Card key={key} className="border-border hover:border-border/80 transition-colors">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Icon className={cn('w-4 h-4', isGood ? 'text-emerald-500' : 'text-amber-500')} />
                  <span className="text-xs font-semibold text-muted-foreground">{abbr}</span>
                </div>
                <span className="text-xs text-muted-foreground/60">{hint}</span>
              </div>
              <p className={cn('text-xl font-bold tabular-nums', isGood ? 'text-emerald-500' : 'text-amber-500')}>{fmt(value)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
