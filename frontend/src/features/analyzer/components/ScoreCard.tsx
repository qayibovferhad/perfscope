import { cn } from '@/lib/utils';
import { Gauge, Eye, Code2, Search } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card';

const ICONS = { Performance: Gauge, Accessibility: Eye, 'Best Practices': Code2, SEO: Search } as const;

export type ScoreLabel = keyof typeof ICONS;

function colors(s: number) {
  if (s >= 90) return { text: 'text-emerald-500', stroke: '#10b981', border: 'border-emerald-500/25', bg: 'bg-emerald-500/5' };
  if (s >= 50) return { text: 'text-amber-500',   stroke: '#f59e0b', border: 'border-amber-500/25',   bg: 'bg-amber-500/5'   };
  return         { text: 'text-red-500',    stroke: '#ef4444', border: 'border-red-500/25',    bg: 'bg-red-500/5'     };
}

function label(s: number) {
  if (s >= 90) return 'Good';
  if (s >= 50) return 'Needs Improvement';
  return 'Poor';
}

interface Props { label: ScoreLabel; score: number }

export function ScoreCard({ label: l, score }: Props) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const { text, stroke, border, bg } = colors(score);
  const Icon = ICONS[l];

  return (
    <Card className={cn('border transition-all duration-300', border, bg)}>
      <CardContent className="flex flex-col items-center gap-3 pt-6 pb-5">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 68 68">
            <circle cx="34" cy="34" r={r} fill="none" strokeWidth="5" stroke="currentColor" className="text-muted/40" />
            <circle cx="34" cy="34" r={r} fill="none" strokeWidth="5"
              strokeDasharray={circ} strokeDashoffset={circ - (score / 100) * circ}
              strokeLinecap="round" stroke={stroke}
              className="transition-all duration-700 ease-out" />
          </svg>
          <span className={cn('absolute inset-0 flex items-center justify-center text-2xl font-bold tabular-nums', text)}>
            {score}
          </span>
        </div>
        <div className="text-center">
          <div className={cn('flex items-center justify-center gap-1.5 mb-0.5')}>
            <Icon className={cn('w-3.5 h-3.5', text)} />
            <p className="text-sm font-semibold text-foreground">{l}</p>
          </div>
          <p className={cn('text-xs', text)}>{label(score)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
