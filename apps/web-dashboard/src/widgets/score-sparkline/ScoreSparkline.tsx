import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { HistoryEntry } from '@/entities/history';

interface Props {
  entries: HistoryEntry[];
  width?:  number;
  height?: number;
}

/**
 * Compact line chart for performance-score evolution + trend delta.
 */
export function ScoreSparkline({ entries, width = 120, height = 32 }: Props) {
  const scores = entries.map(e => e.scores.performance);
  const min    = Math.min(...scores);
  const max    = Math.max(...scores);
  const xOf    = (i: number) => scores.length === 1 ? width / 2 : (i / (scores.length - 1)) * width;
  const yOf    = (v: number) => height - 4 - ((v - min) / (max - min || 1)) * (height - 8);
  const path   = scores.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
  const last   = scores[scores.length - 1];
  const prev   = scores.length >= 2 ? scores[scores.length - 2] : undefined;
  const trend  = prev === undefined ? 0 : last - prev;

  const trendColor =
    trend > 0 ? 'text-ps-healthy'
    : trend < 0 ? 'text-ps-regression'
    : 'text-ps-muted';

  return (
    <div className="flex items-center gap-3">
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <path
          d={path}
          fill="none"
          stroke="var(--ps-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 4px var(--ps-accent-glow))' }}
        />
        <circle
          cx={xOf(scores.length - 1)}
          cy={yOf(last)}
          r="3.5"
          fill="var(--ps-accent)"
          stroke="rgba(17,24,39,0.9)"
          strokeWidth="1.5"
          style={{ filter: 'drop-shadow(0 0 6px var(--ps-accent-glow-lg))' }}
        />
      </svg>
      <div className="flex flex-col">
        <span className="text-[22px] font-black tabular-nums leading-none text-ps-heading">
          {Math.round(last)}
        </span>
        <span className={`text-[10px] flex items-center gap-0.5 mt-0.5 ${trendColor}`}>
          {trend > 0 ? <TrendingUp className="w-3 h-3" />
            : trend < 0 ? <TrendingDown className="w-3 h-3" />
            : <Minus className="w-3 h-3" />}
          {trend !== 0 ? `${trend > 0 ? '+' : ''}${Math.round(trend)} pts` : 'stable'}
        </span>
      </div>
    </div>
  );
}
