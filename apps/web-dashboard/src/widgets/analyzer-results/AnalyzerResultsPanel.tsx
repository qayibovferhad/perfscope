import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { ScoreCard, MetricsGrid, type ScoreLabel } from '@/entities/analysis';
import { AuditList } from '@/features/analyzer/components/AuditList';
import { AiInsights } from '@/features/analyzer/components/AiInsights';
import { ResourceBreakdown } from '@/features/analyzer/components/ResourceBreakdown';
import { ResourceWaterfall } from '@/features/analyzer/ui/ResourceWaterfall';
import { PerformanceTimeline } from '@/features/analyzer/components/PerformanceTimeline';
import { TimelineWaterfall } from '@/features/analyzer/components/TimelineWaterfall';
import { ChordDiagram } from '@/features/analyzer/components/ChordDiagram';
import { HeapMemoryChart } from '@/features/analyzer/components/HeapMemoryChart';
import { InteractionTimeline } from '@/features/analyzer/components/InteractionTimeline';
import { CLSVisualizer } from '@/features/analyzer/components/CLSVisualizer';
import { ResourcesAlert } from '@/features/analyzer/components/ResourcesAlert';
import { TimelineProvider, useTimelineContext } from '@/features/analyzer/context/TimelineContext';
import type { AnalysisResult, DependencyGraph } from '@/entities/analysis';

// ─── Internals ────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] tracking-[.14em] uppercase text-ld-text-3 mt-[30px] mb-[14px]">
      {children}
    </p>
  );
}

function ChordDiagramWithContext({ graph }: { graph: DependencyGraph }) {
  const ctx = useTimelineContext();
  const handleHover = ctx ? (url: string) => ctx.hoveredUrl.set(url) : undefined;
  return <ChordDiagram graph={graph} onResourceHover={handleHover} />;
}

const SCORE_ITEMS: { label: ScoreLabel; scoreKey: keyof AnalysisResult['scores'] }[] = [
  { label: 'Performance',    scoreKey: 'performance'   },
  { label: 'Accessibility',  scoreKey: 'accessibility' },
  { label: 'Best Practices', scoreKey: 'bestPractices' },
  { label: 'SEO',            scoreKey: 'seo'           },
];

// ─── Main widget ─────────────────────────────────────────────────────────────

interface Props { data: AnalysisResult }

export function AnalyzerResultsPanel({ data }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-8"
    >
      <p className="text-xs text-muted-foreground -mb-4">
        Results for{' '}
        <a href={data.url} target="_blank" rel="noreferrer"
          className="font-medium text-foreground underline underline-offset-2">
          {data.url}
        </a>
      </p>

      {data.authRedirectDetected && (
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm border"
          style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)', color: '#f59e0b' }}
        >
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            This page redirected to a login screen — the results below are for the login page, not the URL you entered.{' '}
            <span className="opacity-70">Save a session for this website to audit protected pages.</span>
          </span>
        </div>
      )}

      <section>
        <SectionTitle>Scores</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-[14px]">
          {SCORE_ITEMS.map(({ label, scoreKey }) => (
            <ScoreCard key={label} label={label} score={data.scores[scoreKey]} />
          ))}
        </div>
      </section>

      {data.aiInsights && <AiInsights insights={data.aiInsights} />}

      <section>
        <SectionTitle>Core Web Vitals</SectionTitle>
        <MetricsGrid metrics={data.metrics} />
      </section>

      {(data.timelineData || data.resources || data.dependencyGraph || data.heapMemoryData || data.interactionData) && (
        <TimelineProvider>
          {data.timelineData && data.resources ? (
            <section>
              <TimelineWaterfall
                timelineData={data.timelineData}
                resources={data.resources}
                flameChartData={data.flameChartData}
              />
              <div className="mt-3">
                <ResourceBreakdown resources={data.resources} />
              </div>
            </section>
          ) : (
            <div className="space-y-8">
              {data.timelineData && (
                <section>
                  <SectionTitle>Performance Timeline</SectionTitle>
                  <PerformanceTimeline timelineData={data.timelineData} />
                </section>
              )}
              {data.resources && (
                <section className="space-y-3">
                  <SectionTitle>Resources</SectionTitle>
                  <ResourcesAlert resources={data.resources} />
                  <ResourceWaterfall resources={data.resources} />
                  <ResourceBreakdown resources={data.resources} />
                </section>
              )}
            </div>
          )}

          {data.dependencyGraph && data.dependencyGraph.links.length > 0 && (
            <section className="mt-8">
              <SectionTitle>Resource Dependency Chain</SectionTitle>
              <Card>
                <CardContent className="pt-4 pb-2 px-2">
                  <ChordDiagramWithContext graph={data.dependencyGraph} />
                </CardContent>
              </Card>
            </section>
          )}

          {data.heapMemoryData && (
            <section className="mt-8">
              <SectionTitle>JS Heap Memory</SectionTitle>
              <Card>
                <CardContent className="pt-4 pb-4 px-4">
                  <HeapMemoryChart data={data.heapMemoryData} />
                </CardContent>
              </Card>
            </section>
          )}

          {data.interactionData && (
            <section className="mt-8">
              <SectionTitle>Interaction Responsiveness (FID / INP)</SectionTitle>
              <InteractionTimeline data={data.interactionData} />
            </section>
          )}

          {data.clsData && data.timelineData && (
            <section className="mt-8">
              <SectionTitle>Layout Shift Visualizer (CLS)</SectionTitle>
              <CLSVisualizer clsData={data.clsData} timelineData={data.timelineData} />
            </section>
          )}
        </TimelineProvider>
      )}

      {data.audits.length > 0 && (
        <section>
          <SectionTitle>
            Critical ({data.audits.filter(a => a.impact === 'critical').length}) · Other ({data.audits.filter(a => a.impact !== 'critical').length})
          </SectionTitle>
          <AuditList audits={data.audits} />
        </section>
      )}

      <div className="flex justify-center pt-2">
        <Link
          to={`/history?url=${encodeURIComponent(data.url)}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ps-btn-ghost"
        >
          <TrendingUp className="w-4 h-4" />
          View Full History
        </Link>
      </div>
    </motion.div>
  );
}
