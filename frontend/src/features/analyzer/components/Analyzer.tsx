import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAnalysis, type PartialMap } from '../hooks/useAnalysis';
import { ScoreCard, ScoreCardSkeleton, type ScoreLabel } from './ScoreCard';
import { MetricsGrid } from './MetricsGrid';
import { AuditList } from './AuditList';
import { AiInsights } from './AiInsights';
import { ProgressStepper } from './ProgressStepper';
import { ResourceBreakdown } from './ResourceBreakdown';
import { PerformanceTimeline, PerformanceTimelineSkeleton } from './PerformanceTimeline';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type { AnalysisResult } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
      {children}
    </h2>
  );
}

const SCORE_ITEMS: { categoryKey: string; label: ScoreLabel; scoreKey: keyof AnalysisResult['scores'] }[] = [
  { categoryKey: 'performance',    label: 'Performance',     scoreKey: 'performance'   },
  { categoryKey: 'accessibility',  label: 'Accessibility',   scoreKey: 'accessibility' },
  { categoryKey: 'best-practices', label: 'Best Practices',  scoreKey: 'bestPractices' },
  { categoryKey: 'seo',            label: 'SEO',             scoreKey: 'seo'           },
];

// ─── Streaming Scores Section ─────────────────────────────────────────────────

function StreamingScores({ partials }: { partials: PartialMap }) {
  return (
    <section>
      <SectionTitle>Scores</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SCORE_ITEMS.map(({ categoryKey, label }) => {
          const partial = partials[categoryKey as keyof PartialMap];
          return partial
            ? <ScoreCard key={categoryKey} label={label} score={partial.score} />
            : <ScoreCardSkeleton   key={categoryKey} label={label} />;
        })}
      </div>
    </section>
  );
}

// ─── Streaming Metrics Section ────────────────────────────────────────────────

function StreamingMetrics({ partials }: { partials: PartialMap }) {
  const metrics = partials['performance']?.metrics;
  return (
    <section>
      <SectionTitle>Core Web Vitals</SectionTitle>
      {metrics
        ? <MetricsGrid metrics={metrics} />
        : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border-border">
                <CardContent className="pt-4 pb-4 space-y-2">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-3 w-28" />
                </CardContent>
              </Card>
            ))}
          </div>
        )
      }
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Analyzer() {
  const [url, setUrl] = useState('');
  const { analyze, data, progress, partials, isPending, isError, error, reset } = useAnalysis();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    reset();
    analyze(normalized);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">PerfScope</h1>
        <p className="text-sm text-muted-foreground">Analyze any website's performance with Lighthouse</p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enter a URL to analyze</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              type="text"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isPending}
              className="flex-1"
            />
            <Button type="submit" disabled={isPending || !url.trim()} className="min-w-[130px]">
              <Search className="w-4 h-4 mr-2" />
              {isPending ? 'Analyzing...' : 'Analyze'}
            </Button>
          </form>

          <AnimatePresence>
            {isPending && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-5 overflow-hidden"
              >
                <ProgressStepper progress={progress ?? { analysisId: '', stage: 'launching', progress: 0, message: 'Connecting...' }} />
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Error */}
      {isError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-2 pt-4 pb-4 text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-sm">{error ?? 'Analysis failed'}</p>
          </CardContent>
        </Card>
      )}

      {/* Streaming skeleton + partial results */}
      {isPending && (
        <div className="space-y-8">
          <StreamingScores partials={partials} />
          <StreamingMetrics partials={partials} />
          <section>
            <SectionTitle>Performance Timeline</SectionTitle>
            <PerformanceTimelineSkeleton />
          </section>
        </div>
      )}

      {/* Final complete results */}
      <AnimatePresence>
        {data && (
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

            <section>
              <SectionTitle>Scores</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

            {data.timelineData && (
              <section>
                <SectionTitle>Performance Timeline</SectionTitle>
                <PerformanceTimeline timelineData={data.timelineData} />
              </section>
            )}

            {data.resources && (
              <section className="space-y-3">
                <SectionTitle>Resources</SectionTitle>
                {(() => {
                  const criticalCount = data.resources!.requests.filter((r) => r.isCritical).length;
                  const hasAdvice = data.resources!.requests.some((r) => r.isCritical && r.advice);
                  if (criticalCount === 0) return null;
                  return (
                    <Alert variant="warning">
                      <AlertTriangle className="w-4 h-4" />
                      <AlertTitle>
                        {criticalCount} oversized {criticalCount === 1 ? 'resource' : 'resources'} detected
                      </AlertTitle>
                      <AlertDescription>
                        {criticalCount === 1
                          ? 'One resource exceeds the recommended size limit.'
                          : `${criticalCount} resources exceed recommended size limits (JS > 500 KB, images > 1 MB).`}
                        {hasAdvice && ' Hover the warning icons below for AI-powered optimization tips.'}{' '}
                    For accurate results, analyze your production URL — dev builds serve unminified assets.
                      </AlertDescription>
                    </Alert>
                  );
                })()}
                <ResourceBreakdown resources={data.resources} />
              </section>
            )}

            {data.audits.length > 0 && (
              <section>
                <SectionTitle>
                  Critical ({data.audits.filter((a) => a.impact === 'critical').length}) · Other ({data.audits.filter((a) => a.impact !== 'critical').length})
                </SectionTitle>
                <AuditList audits={data.audits} />
              </section>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
