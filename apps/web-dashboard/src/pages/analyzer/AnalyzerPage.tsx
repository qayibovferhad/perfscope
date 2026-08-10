import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { apiClient } from '@/shared/api/client';
import { normalizeUrl } from '@/shared/lib/utils';
import { useAnalysis } from '@/features/analyzer/model/useAnalysis';
import { TimelineWaterfallSkeleton } from '@/features/analyzer/ui/TimelineWaterfall';
import { AnalyzerHeader } from '@/widgets/analyzer-header';
import { AnalyzerSearchForm } from '@/features/analyzer/ui/AnalyzerSearchForm';
import { StreamingScores } from '@/features/analyzer/ui/StreamingScores';
import { StreamingMetrics } from '@/features/analyzer/ui/StreamingMetrics';
import { AuthAuditModal, useAuthAuditStore } from '@/features/auth-audit';
import { usePrefetchStore, useAuditModeStore, type AuditFormFactor } from '@/entities/analysis';
import { useWebsites } from '@/entities/website';
import { AnalyzerResultsPanel } from '@/widgets/analyzer-results';
import { AnalysisIdlePanel } from '@/widgets/analysis-idle';

export function AnalyzerPage() {
  const [searchParams] = useSearchParams();
  const { analyze, bootstrap, adoptRunning, startAuthAudit, data, progress, partials, isPending, isError, error, reset, lastUrl } = useAnalysis();
  const [url, setUrl]             = useState(() => searchParams.get('url') ?? searchParams.get('prefill') ?? lastUrl ?? '');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { formFactor, setFormFactor } = useAuditModeStore();
  const { sessionId: authSessionId } = useAuthAuditStore();
  const { websites } = useWebsites();
  const activeSession = websites.find(w => url.startsWith(w.url) && w.session != null) ?? null;
  const handledUrl = useRef<string | null>(null);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    const ff = searchParams.get('ff');
    if (ff === 'mobile' || ff === 'desktop') setFormFactor(ff);

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

    const normalized = normalizeUrl(paramUrl);
    reset();
    analyze(normalized, projectId, (ff === 'mobile' || ff === 'desktop') ? ff : useAuditModeStore.getState().formFactor);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFormFactor(next: AuditFormFactor) {
    if (next === formFactor) return;
    setFormFactor(next);
    // A visible result in the other mode is an explicit ask for this mode's numbers —
    // re-run the same URL right away instead of making the user press Analyze again.
    if (data && !isPending) {
      const target = normalizeUrl(url.trim() || data.url);
      const projectId = searchParams.get('projectId') ?? undefined;
      reset();
      analyze(target, projectId, next);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    const normalized = normalizeUrl(url);
    const projectId  = searchParams.get('projectId') ?? undefined;
    if (authSessionId) {
      startAuthAudit(authSessionId, normalized, formFactor);
    } else {
      reset();
      analyze(normalized, projectId, formFactor);
    }
  }

  async function handleShare() {
    if (!data) return;
    try {
      const res = await apiClient.post<{ token: string }>(`/history/${data.id}/share`);
      const link = `${window.location.origin}/report/${res.data.token}`;
      await navigator.clipboard.writeText(link);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2500);
    } catch {
      // History persists asynchronously right after an audit — a retry moment later succeeds.
      setShareState('idle');
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
    <>
    {/* Outside the space-y-8 container so it never counts as a spacing sibling.
        Modal also portals to <body>, so this placement is belt-and-braces. */}
    <AuthAuditModal
      open={authModalOpen}
      initialUrl={url}
      onClose={() => setAuthModalOpen(false)}
      onSetUrl={setUrl}
    />

    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <AnalyzerHeader
        hasData={!!data}
        onExport={handleExport}
        onAuthModal={() => setAuthModalOpen(true)}
        onShare={handleShare}
        shareState={shareState}
      />

      <AnalyzerSearchForm
        url={url}
        setUrl={setUrl}
        isPending={isPending}
        authSessionId={authSessionId}
        hasSession={!!activeSession}
        progress={progress}
        formFactor={formFactor}
        onFormFactor={handleFormFactor}
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
        <div className="space-y-2">
          <section>
            <p className="font-mono text-[11px] tracking-[.14em] uppercase text-ld-text-3 mt-[30px] mb-[14px]">Scores</p>
            <StreamingScores partials={partials} />
          </section>
          <section>
            <p className="font-mono text-[11px] tracking-[.14em] uppercase text-ld-text-3 mt-[30px] mb-[14px]">Core Web Vitals</p>
            <StreamingMetrics partials={partials} />
          </section>
          <section>
            <p className="font-mono text-[11px] tracking-[.14em] uppercase text-ld-text-3 mt-[30px] mb-[14px]">Network Waterfall</p>
            <TimelineWaterfallSkeleton />
          </section>
        </div>
      )}

      {/* Idle: the page below the form was otherwise blank on first visit */}
      {!isPending && !data && !isError && (
        <AnalysisIdlePanel variant="analyze" sites={websites} onPick={setUrl} />
      )}

      <AnimatePresence>
        {data && <AnalyzerResultsPanel data={data} />}
      </AnimatePresence>
    </div>
    </>
  );
}
