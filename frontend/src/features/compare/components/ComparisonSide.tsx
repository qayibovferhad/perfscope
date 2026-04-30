import type { MotionValue } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { MetricsGrid } from '../../analyzer/components/MetricsGrid';
import { InteractionTimeline } from '../../analyzer/components/InteractionTimeline';
import { HeapMemoryChart } from '../../analyzer/components/HeapMemoryChart';
import { TimelineProvider } from '../../analyzer/context/TimelineContext';
import { ScoreCard } from '../../analyzer/components/ScoreCard';
import type { AnalysisResult } from '../../analyzer/types';

type Side = 'target' | 'competitor';

interface Props {
  side:           Side;
  data:           AnalysisResult;
  sharedMotionMs: MotionValue<number>;
  onData:         (result: AnalysisResult) => void;
  onReset:        () => void;
}

const SIDE_LABELS: Record<Side, string> = {
  target:     'Your Site',
  competitor: 'Competitor',
};

const SIDE_COLORS: Record<Side, string> = {
  target:     '#6366f1',
  competitor: '#f97316',
};

const SCORE_ITEMS = [
  { label: 'Performance'    as const, key: 'performance'   as const },
  { label: 'Accessibility'  as const, key: 'accessibility'  as const },
  { label: 'Best Practices' as const, key: 'bestPractices'  as const },
  { label: 'SEO'            as const, key: 'seo'            as const },
];

export function ComparisonSide({ side, data, sharedMotionMs }: Props) {
  const color = SIDE_COLORS[side];
  const label = SIDE_LABELS[side];

  return (
    <TimelineProvider sharedMotionMs={sharedMotionMs}>
      <div className="flex flex-col gap-6">

        {/* Side header */}
        <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: color + '30' }}>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-sm font-semibold" style={{ color }}>{label}</span>
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors truncate max-w-[200px]"
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

        {/* Core Web Vitals */}
        <section>
          <SectionLabel>Core Web Vitals</SectionLabel>
          <MetricsGrid metrics={data.metrics} />
        </section>

        {/* Interaction Timeline */}
        {data.interactionData && (
          <section>
            <SectionLabel>Interaction Responsiveness (INP)</SectionLabel>
            <InteractionTimeline data={data.interactionData} />
          </section>
        )}

        {/* Heap Memory */}
        {data.heapMemoryData && (
          <section>
            <SectionLabel>JS Heap Memory</SectionLabel>
            <Card>
              <CardContent className="pt-4 pb-4 px-4">
                <HeapMemoryChart data={data.heapMemoryData} />
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </TimelineProvider>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
      {children}
    </h3>
  );
}
