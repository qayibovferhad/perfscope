import type { MotionValue } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { InteractionTimeline } from '../../analyzer/components/InteractionTimeline';
import { HeapMemoryChart } from '../../analyzer/components/HeapMemoryChart';
import { TimelineProvider } from '../../analyzer/context/TimelineContext';
import { ScoreCard } from '../../analyzer/components/ScoreCard';
import { CompareMetricsGrid } from './CompareMetricsGrid';
import type { AnalysisResult } from '../../analyzer/types';

// ─── Constants ────────────────────────────────────────────────────────────────

type Side = 'target' | 'competitor';

const SIDE_LABELS: Record<Side, string>  = { target: 'Your Site', competitor: 'Competitor' };
const SIDE_COLORS: Record<Side, string>  = { target: '#6366f1',   competitor: '#f97316'    };

const SCORE_ITEMS = [
  { label: 'Performance'    as const, key: 'performance'   as const },
  { label: 'Accessibility'  as const, key: 'accessibility'  as const },
  { label: 'Best Practices' as const, key: 'bestPractices'  as const },
  { label: 'SEO'            as const, key: 'seo'            as const },
];

const DARK_CARD: React.CSSProperties = {
  background:   'rgba(255,255,255,0.03)',
  border:       '1px solid rgba(255,255,255,0.09)',
  borderRadius: '0.875rem',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  side:           Side;
  data:           AnalysisResult;
  sharedMotionMs: MotionValue<number>;
  onData:         (result: AnalysisResult) => void;
  onReset:        () => void;
}

export function ComparisonSide({ side, data, sharedMotionMs }: Props) {
  const color = SIDE_COLORS[side];
  const label = SIDE_LABELS[side];

  return (
    <TimelineProvider sharedMotionMs={sharedMotionMs}>
      <div className="flex flex-col gap-5">

        {/* Side header */}
        <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: color + '28' }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-sm font-semibold" style={{ color }}>{label}</span>
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs flex items-center gap-0.5 transition-colors truncate max-w-[200px]"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => { try { return new URL(data.url).hostname; } catch { return data.url; } })()}
            <ExternalLink className="w-2.5 h-2.5 ml-0.5 shrink-0" />
          </a>
        </div>

        {/* Score cards */}
        <div className="grid grid-cols-2 gap-2">
          {SCORE_ITEMS.map(({ label: lbl, key }) => (
            <ScoreCard key={key} label={lbl} score={data.scores[key]} />
          ))}
        </div>

        {/* Core Web Vitals — dark glass cards */}
        <section>
          <SectionLabel>Core Web Vitals</SectionLabel>
          <CompareMetricsGrid metrics={data.metrics} />
        </section>

        {/* Interaction Timeline */}
        {data.interactionData && (
          <section>
            <SectionLabel>Interaction Responsiveness (INP)</SectionLabel>
            <div style={DARK_CARD} className="px-4 pt-4 pb-3">
              <InteractionTimeline data={data.interactionData} darkVariant />
            </div>
          </section>
        )}

        {/* Heap Memory */}
        {data.heapMemoryData && (
          <section>
            <SectionLabel>JS Heap Memory</SectionLabel>
            <div style={{ ...DARK_CARD, padding: '1rem 1rem 0.75rem' }}>
              <HeapMemoryChart data={data.heapMemoryData} />
            </div>
          </section>
        )}
      </div>
    </TimelineProvider>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-[10px] font-bold uppercase tracking-widest mb-2.5"
      style={{ color: '#475569' }}
    >
      {children}
    </h3>
  );
}
