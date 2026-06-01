import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { useAnalysis } from '@/features/analyzer/hooks/useAnalysis';
import { PerformanceTimelineSkeleton } from '@/features/analyzer/components/PerformanceTimeline';
import { AnalyzerHeader } from '@/features/analyzer/components/AnalyzerHeader';
import { AnalyzerSearchForm } from '@/features/analyzer/components/AnalyzerSearchForm';
import { StreamingScores } from '@/features/analyzer/components/StreamingScores';
import { StreamingMetrics } from '@/features/analyzer/components/StreamingMetrics';
import { AuthAuditModal } from '@/features/analyzer/components/AuthAuditModal';
import { useAuthAuditStore } from '@/store/authAuditStore';
import { usePrefetchStore } from '@/store/prefetchStore';
import { useWebsites } from '@/features/dashboard/hooks/useWebsites';
import { AnalyzerResultsPanel } from '@/widgets/analyzer-results';

export function AnalyzerPage() {
  const [searchParams] = useSearchParams();
  const { analyze, bootstrap, adoptRunning, startAuthAudit, data, progress, partials, isPending, isError, error, reset, lastUrl } = useAnalysis();
  const [url, setUrl]             = useState(() => searchParams.get('url') ?? searchParams.get('prefill') ?? lastUrl ?? '');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { sessionId: authSessionId } = useAuthAuditStore();
  const { websites } = useWebsites();
  const activeSession = websites.find(w => url.startsWith(w.url) && w.session != null) ?? null;
  const handledUrl = useRef<string | null>(null);

  useEffect(() => {
    const paramUrl  = searchParams.get('url');
    const projectId = searchParams.get('projectId') ?? undefined;
    if (!paramUrl || paramUrl === handledUrl.current) return;
    handledUrl.current = paramUrl;
    setUrl(paramUrl);

    const prefetch = usePrefetchStore.getState();
    if (prefetch.url === paramUrl) {
      if (prefetch.status === 'success' && prefetch.result) {
        bootstrap(prefetch.result, paramUrl);
        prefetch.clear();
        return;
      }
      if (prefetch.status === 'loading') {
        adoptRunning();
        prefetch.clear();
        return;
      }
    }

    const normalized = paramUrl.startsWith('http') ? paramUrl : `https://${paramUrl}`;
    reset();
    analyze(normalized, projectId);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed    = url.trim();
    if (!trimmed) return;
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const projectId  = searchParams.get('projectId') ?? undefined;
    if (authSessionId) {
      startAuthAudit(authSessionId, normalized);
    } else {
      reset();
      analyze(normalized, projectId);
    }
  }

  function handleExport() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = href;
    a.download = `perfscope-${new URL(data.url).hostname}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <AuthAuditModal
        open={authModalOpen}
        initialUrl={url}
        onClose={() => setAuthModalOpen(false)}
        onSetUrl={setUrl}
      />

      <AnalyzerHeader
        hasData={!!data}
        onExport={handleExport}
        onAuthModal={() => setAuthModalOpen(true)}
      />

      <AnalyzerSearchForm
        url={url}
        setUrl={setUrl}
        isPending={isPending}
        authSessionId={authSessionId}
        hasSession={!!activeSession}
        progress={progress}
        onSubmit={handleSubmit}
      />

      {isError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-2 pt-4 pb-4 text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-sm">{error ?? 'Analysis failed'}</p>
          </CardContent>
        </Card>
      )}

      {isPending && (
        <div className="space-y-8">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Scores</h2>
            <StreamingScores partials={partials} />
          </section>
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Core Web Vitals</h2>
            <StreamingMetrics partials={partials} />
          </section>
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Performance Timeline</h2>
            <PerformanceTimelineSkeleton />
          </section>
        </div>
      )}

      <AnimatePresence>
        {data && <AnalyzerResultsPanel data={data} />}
      </AnimatePresence>
    </div>
  );
}
