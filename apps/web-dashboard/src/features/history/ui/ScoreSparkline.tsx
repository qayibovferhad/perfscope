import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { HistoryEntry } from '@/entities/history';

interface Props {
  entries: HistoryEntry[];
  width?:  number;
  height?: number;
}

export function ScoreSparkline({ entries, width = 88, height = 26 }: Props) {
  const scores = entries.map(e => e.scores.performance);
  const min    = Math.min(...scores);
  const max    = Math.max(...scores);
  const xOf    = (i: number) => scores.length === 1 ? width / 2 : (i / (scores.length - 1)) * width;
  const yOf    = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6);
  const path   = scores.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
  const last   = scores.at(-1)!;
  const prev   = scores.length >= 2 ? scores.at(-2) : undefined;
  const trend  = prev === undefined ? 0 : last - prev;

  const trendCls = trend > 0 ? 'text-ld-accent-2' : trend < 0 ? 'text-ld-rose' : 'text-ld-text-3';
  const Icon     = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;

  const areaPath = scores.length > 1
    ? `${path} L${xOf(scores.length - 1).toFixed(1)},${height} L${xOf(0).toFixed(1)},${height} Z`
    : '';

  return (
    <div className="flex items-center gap-[14px]">
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--ld-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--ld-accent)" stopOpacity="0"    />
          </linearGradient>
        </defs>
        {areaPath && <path d={areaPath} fill="url(#spark-fill)" />}
        <path
          d={path} fill="none"
          stroke="var(--ld-accent)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        />
        <circle
          cx={xOf(scores.length - 1)} cy={yOf(last)} r="3"
          fill="var(--ld-accent)" stroke="var(--ld-surface)" strokeWidth="1.5"
        />
      </svg>

      <div>
        <b className="font-mono text-[30px] font-semibold tracking-[-0.03em] text-ld-text block leading-none">
          {Math.round(last)}
        </b>
        <span className={`inline-flex items-center gap-[4px] font-mono text-[12px] font-semibold mt-[5px] ${trendCls}`}>
          <Icon className="w-[12px] h-[12px]" />
          {trend !== 0 ? `${trend > 0 ? '+' : ''}${Math.round(trend)} pts` : 'stable'}
        </span>
      </div>
    </div>
  );
}
