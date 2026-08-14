import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, ShieldAlert, Monitor, Smartphone, Crosshair, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ScoreCard, MetricsGrid, AuditList, type ScoreLabel } from '@/entities/analysis';
import { AiInsights } from '@/features/analyzer';
import { ResourceBreakdown } from '@/features/analyzer';
import { ResourceWaterfall } from '@/features/analyzer';
import { PerformanceTimeline } from '@/features/analyzer';
import { TimelineWaterfall } from '@/features/analyzer';
import { ResourceDependencyChain } from '@/features/analyzer';
import { HeapMemoryChart } from '@/features/analyzer';
import { InteractionTimeline } from '@/features/analyzer';
import { CLSVisualizer } from '@/features/analyzer';
import { ResourcesAlert } from '@/features/analyzer';
import { ThirdPartyPanel } from '@/features/analyzer';
import { useCruxData, CruxFieldPanel } from '@/features/crux';
import { TimelineProvider } from '@/features/analyzer';
import type { AnalysisResult } from '@/entities/analysis';

// ─── Internals ────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] tracking-[.14em] uppercase text-ld-text-3 mt-[30px] mb-[14px]">
      {children}
    </p>
  );
}


const SCORE_ITEMS: { label: ScoreLabel; scoreKey: keyof AnalysisResult['scores'] }[] = [
  { label: 'Performance',    scoreKey: 'performance'   },
  { label: 'Accessibility',  scoreKey: 'accessibility' },
  { label: 'Best Practices', scoreKey: 'bestPractices' },
  { label: 'SEO',            scoreKey: 'seo'           },
];

// ─── Main widget ─────────────────────────────────────────────────────────────

interface Props { data: AnalysisResult }

/** Score gap across runs beyond which the page's own variance dominates the number. */
const NOISY_SPREAD = 8;

export function AnalyzerResultsPanel({ data }: Props) {
  const measurement = data.measurement;
  // Field data for the same URL/device — renders nothing when Chrome has no
  // real-user sample for this page (or the server has no CrUX key).
  const { data: crux, isLoading: cruxLoading } = useCruxData(data.url, data.formFactor ?? 'desktop');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-8"
    >
      <p className="text-xs text-muted-foreground -mb-4 flex items-center gap-2">
        <span>
          Results for{' '}
          <a href={data.url} target="_blank" rel="noreferrer"
            className="font-medium text-foreground underline underline-offset-2">
            {data.url}
          </a>
        </span>
        {data.formFactor && (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[.08em] px-[8px] py-[3px] rounded-full border border-ld-border-strong text-ld-text-3">
            {data.formFactor === 'mobile' ? <Smartphone className="w-[11px] h-[11px]" /> : <Monitor className="w-[11px] h-[11px]" />}
            {data.formFactor}
          </span>
        )}
        {measurement && measurement.runs > 1 && (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[.08em] px-[8px] py-[3px] rounded-full border border-ld-accent-line bg-ld-accent-soft text-ld-accent"
            title={`Runs scored ${measurement.scores.join(', ')} — the median run is reported`}
          >
            <Crosshair className="w-[11px] h-[11px]" />
            median of {measurement.runs}
          </span>
        )}
      </p>

      {/* A wide spread means the page itself measures unreliably — say so instead of
          letting the reader treat one number as exact. */}
      {measurement && measurement.spread >= NOISY_SPREAD && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm border border-ld-amber-line bg-ld-amber-wash text-ld-amber">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            This page measures unevenly — the {measurement.runs} runs scored{' '}
            <b className="font-semibold">{measurement.scores.join(', ')}</b> ({measurement.spread} points apart).
            Treat single-point comparisons with care.
          </span>
        </div>
      )}

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
              <ResourceDependencyChain
                graph={data.dependencyGraph}
                resources={data.resources?.requests}
              />
            </section>
          )}

          {data.heapMemoryData && (
            <section className="mt-8">
                  <HeapMemoryChart data={data.heapMemoryData} />
            </section>
          )}

          {data.interactionData && (
            <section className="mt-8">
              <InteractionTimeline data={data.interactionData} />
            </section>
          )}

          {data.clsData && data.timelineData && (
            <section className="mt-8">
              <CLSVisualizer clsData={data.clsData} timelineData={data.timelineData} />
            </section>
          )}
        </TimelineProvider>
      )}

      <CruxFieldPanel data={crux} isLoading={cruxLoading} />

      {data.thirdParty && data.thirdParty.length > 0 && (
        <section>
          <SectionTitle>Third-party impact</SectionTitle>
          <ThirdPartyPanel entities={data.thirdParty} />
        </section>
      )}

      {data.audits.length > 0 && (
        <section>
          <AuditList audits={data.audits} />
        </section>
      )}

      <div className="flex justify-center pt-2">
        <Button asChild>
          <Link to={`/history?url=${encodeURIComponent(data.url)}`}>
            <TrendingUp />
            View Full History
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
