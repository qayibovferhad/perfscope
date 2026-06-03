import { SCORE_GOOD, SCORE_WARN, SCORE_BAD } from '@/entities/analysis';
import { ScoreGauge } from './ScoreGauge';

interface Props {
  label: string; tag: string; tagColor: string;
  perf: number; cls: string; lcp: string; tbt: string;
}

const SCORE_MAP: Record<string, { card: string; text: string }> = {
  [SCORE_GOOD]: { card: 'bg-ps-healthy-muted border-ps-healthy-border', text: 'text-ps-healthy'    },
  [SCORE_WARN]: { card: 'bg-ps-amber-muted   border-ps-amber-border',   text: 'text-ps-amber'      },
  [SCORE_BAD]:  { card: 'bg-ps-reg-muted     border-ps-reg-border',     text: 'text-ps-regression' },
};

const DEFAULT = SCORE_MAP[SCORE_BAD];

function clsColor(v: string)  { const n = parseFloat(v); return n < 0.1  ? SCORE_GOOD : n < 0.25 ? SCORE_WARN : SCORE_BAD; }
function lcpColor(v: string)  { const n = parseFloat(v); return n < 2.5  ? SCORE_GOOD : n < 4    ? SCORE_WARN : SCORE_BAD; }
function tbtColor(v: string)  { const n = parseInt(v);   return n < 200  ? SCORE_GOOD : n < 600  ? SCORE_WARN : SCORE_BAD; }

export function BenchmarkPanel({ label, tag, tagColor, perf, cls, lcp, tbt }: Props) {
  const tagStyle = SCORE_MAP[tagColor] ?? DEFAULT;

  const metrics = [
    { val: cls, label: 'CLS', ...SCORE_MAP[clsColor(cls)] },
    { val: lcp, label: 'LCP', ...SCORE_MAP[lcpColor(lcp)] },
    { val: tbt, label: 'TBT', ...SCORE_MAP[tbtColor(tbt)] },
  ];

  return (
    <div className="ps-panel rounded-[1.25rem] p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm text-ps-heading">{label}</h4>
        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${tagStyle.card} ${tagStyle.text}`}>
          {tag}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 justify-items-center">
        <ScoreGauge score={perf} label="Performance" />
        {metrics.map(({ val, label: ml, card, text }) => (
          <div key={ml} className="flex flex-col items-center gap-2">
            <div className={`w-20 h-20 rounded-xl flex flex-col items-center justify-center border ${card}`}>
              <span className={`text-xl font-extrabold font-mono ${text}`}>{val}</span>
            </div>
            <p className="text-xs font-medium text-ps-muted">{ml}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
