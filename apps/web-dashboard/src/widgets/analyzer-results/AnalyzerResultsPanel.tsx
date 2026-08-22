import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, ShieldAlert, Monitor, Smartphone, Crosshair, AlertTriangle, Timer, History as HistoryIcon } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { NOISY_SPREAD } from '@perfscope/shared';
import { ScoreCard, MetricsGrid, AuditList, formatElapsed, type ScoreLabel } from '@/entities/analysis';
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
import { SinceLastRun } from '@/features/analyzer';
import { BundleTreemap } from '@/features/analyzer';
import { AskAboutAudit } from '@/features/analyzer';
import { useCruxData, CruxFieldPanel } from '@/features/crux';
import { TimelineProvider } from '@/features/analyzer';
import { AiCard } from '@/shared/ui/ai-card';
import { fmtDateTime } from '@/shared/lib/time';
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

interface Props {
  data: AnalysisResult;
  /**
   * A live audit has its scores but Gemini is still writing. Drives every AI skeleton on
   * the page. Stored results (history, the public report) leave it false — their commentary
   * was written when they were run and is already in `data`.
   */
  aiPending?: boolean;
  /**
   * The question box under the page's AiCard needs an authenticated owner to answer
   * against — this widget also renders the public share report (`PublicReportPage`),
   * which has neither, so the box is opt-in rather than defaulting on.
   */
  askEnabled?: boolean;
  /**
   * Wall clock of the run that produced this result, in ms — what the clock beside the
   * progress bar counted. Absent for a stored audit reopened from history: nobody watched
   * that one, and borrowing another run's number would be a fabrication.
   */
  durationMs?: number | null;
}

export function AnalyzerResultsPanel({ data, aiPending, askEnabled, durationMs }: Props) {
  const measurement = data.measurement;
  // `?audit=<id>` opens one finding and scrolls to it. Read here rather than in the entity:
  // routing is a page concern, and AuditList is also rendered by the public report.
  const [searchParams] = useSearchParams();
  const openAuditId = searchParams.get('audit') ?? undefined;
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
        {/* "median of 2" read like a value rather than a method, and the run count now
            varies with the page's own stability, so the badge says what was done instead
            of leaving the reader to infer it. The individual scores stay in the tooltip:
            on the surface they compete with the score they were distilled into. */}
        {measurement && measurement.runs > 1 && (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[.08em] px-[8px] py-[3px] rounded-full border border-ld-accent-line bg-ld-accent-soft text-ld-accent"
            title={`Runs scored ${measurement.scores.join(', ')} — the middle one is reported`}
          >
            <Crosshair className="w-[11px] h-[11px]" />
            measured {measurement.runs}×, middle run reported
          </span>
        )}
        {durationMs != null && (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[.08em] px-[8px] py-[3px] rounded-full border border-ld-border-strong text-ld-text-3"
            title="How long this audit took, end to end"
          >
            <Timer className="w-[11px] h-[11px]" />
            took {formatElapsed(durationMs)}
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
            <ScoreCard
              key={label}
              label={label}
              score={data.scores[scoreKey]}
              previous={data.previous?.scores[scoreKey]}
              since={data.previous?.at}
            />
          ))}
        </div>
        {/* Names the run every arrow on this page is measured against. Without it the
            deltas are movement from an unstated baseline, which is unreadable the moment
            a person audits the same URL twice in an afternoon. */}
        {data.previous && (
          <p className="flex items-center gap-[6px] mt-[12px] font-mono text-[11px] text-ld-text-3 m-0">
            <HistoryIcon className="w-[12px] h-[12px]" aria-hidden />
            Compared with the run from {fmtDateTime(data.previous.at)}
          </p>
        )}
      </section>

      <AiCard text={data.aiInsights} pending={aiPending} />
      {askEnabled && !aiPending && data.aiInsights && (
        <AskAboutAudit subjects={[{ key: 'page', label: 'this audit', analysisId: data.id }]} />
      )}

      <section>
        <SectionTitle>Core Web Vitals</SectionTitle>
        <MetricsGrid
          metrics={data.metrics}
          previous={data.previous?.metrics}
          since={data.previous?.at}
          notes={data.aiMetricNotes}
          aiPending={aiPending}
        />
      </section>

      {(data.timelineData || data.resources || data.dependencyGraph || data.heapMemoryData || data.interactionData) && (
        <TimelineProvider>
          {data.timelineData && data.resources ? (
            <section>
              {/* Above the waterfall because it is the sentence a person would otherwise
                  have to assemble by reading every bar in it. */}
              <AiCard
                title="How this page loaded"
                text={data.aiWaterfallNarrative}
                pending={aiPending}
                className="mb-3"
              />
              <TimelineWaterfall
                timelineData={data.timelineData}
                resources={data.resources}
                flameChartData={data.flameChartData}
                changes={data.previous?.resourceDiff}
              />
              {/* This branch is the one almost every audit takes — a run with a timeline
                  and resources — and it was the only one without the oversized-resource
                  warning, so in practice that warning never appeared. */}
              <div className="mt-3 space-y-3">
                <SinceLastRun previous={data.previous} />
                <ResourcesAlert resources={data.resources} />
                <ResourceBreakdown resources={data.resources} />
                {/* After the breakdown, which answers "how much JavaScript"; this one
                    answers "which JavaScript", and only makes sense in that order. */}
                <BundleTreemap bundles={data.bundles} />
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
                  <SinceLastRun previous={data.previous} />
                  <ResourcesAlert resources={data.resources} />
                  <AiCard title="How this page loaded" text={data.aiWaterfallNarrative} pending={aiPending} />
                  <ResourceWaterfall resources={data.resources} changes={data.previous?.resourceDiff} />
                  <ResourceBreakdown resources={data.resources} />
                  <BundleTreemap bundles={data.bundles} />
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
          <AuditList audits={data.audits} previous={data.previous} aiPending={aiPending} openAuditId={openAuditId} />
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
