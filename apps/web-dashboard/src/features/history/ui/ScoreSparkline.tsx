import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { HistoryEntry } from '@/entities/history';
import { Sparkline } from '@/shared/ui/chart';

/** The history header's headline: latest score, its move, and the shape that got there. */
export function ScoreSparkline({
  entries, width = 88, height = 26,
}: {
  entries: HistoryEntry[];
  width?:  number;
  height?: number;
}) {
  const scores = entries.map(e => e.scores.performance);
  const last   = scores.at(-1) ?? 0;
  const prev   = scores.length >= 2 ? scores.at(-2) : undefined;
  const trend  = prev === undefined ? 0 : last - prev;

  const trendCls = trend > 0 ? 'text-ld-accent-2' : trend < 0 ? 'text-ld-rose' : 'text-ld-text-3';
  const Icon     = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;

  return (
    <div className="flex items-center gap-[14px]">
      <Sparkline id="history-header" values={scores} width={width} height={height} />

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
