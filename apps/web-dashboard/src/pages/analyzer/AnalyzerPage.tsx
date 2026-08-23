import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AlertCircle, Lock } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Page } from '@/shared/ui/page';
import { useAdviceContext } from '@/features/advisor';
import { getHostname } from '@/entities/website';
import { apiClient } from '@/shared/api/client';
import { shareCardBlob, shareCardFilename } from '@/entities/analysis';
import { downloadBlob } from '@/shared/lib/download';
import { toast } from '@/shared/ui/toast';
import { normalizeUrl } from '@/shared/lib/utils';
import { useAnalysis } from '@/features/analyzer';
import { TimelineWaterfallSkeleton } from '@/features/analyzer';
import { AnalyzerHeader } from '@/widgets/analyzer-header';
import { AnalyzerSearchForm } from '@/features/analyzer';
import { StreamingScores } from '@/features/analyzer';
import { StreamingMetrics } from '@/features/analyzer';
import { AuthAuditModal, useAuthAuditStore } from '@/features/auth-audit';
import { usePrefetchStore, useAuditModeStore, useRunningAuditsStore, type AuditFormFactor } from '@/entities/analysis';
import { useWebsites, useUrlSuggestions, sessionState } from '@/entities/website';
import { AnalyzerResultsPanel } from '@/widgets/analyzer-results';
import { AnalysisIdlePanel } from '@/widgets/analysis-idle';

export function AnalyzerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { analyze, cancel, bootstrap, adoptRunning, startAuthAudit, data, progress, partials, isPending, aiPending, isError, error, errorCode, reset, lastUrl, startedAt, durationMs } = useAnalysis();
  // Seeded, in this order: an explicit link, a prefill, the audit that is *running right
  // now* (arriving from the shell's pill), then whatever was audited last. Read in the
  // initialiser rather than an effect — the field's first paint should already be right,
  // and a setState in an effect to fix it up is a second render saying the same thing.
  const [url, setUrl]             = useState(() =>
    searchParams.get('url')
    ?? searchParams.get('prefill')
    ?? useRunningAuditsStore.getState().runs.find(r => r.returnTo === '/app')?.url
    ?? lastUrl
    ?? '');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { formFactor, setFormFactor, precision, setPrecision } = useAuditModeStore();
  const { sessionId: authSessionId } = useAuthAuditStore();
  const { websites } = useWebsites();
  const suggestions   = useUrlSuggestions();
  const matchedSite   = websites.find(w => url.startsWith(w.url) && w.session != null) ?? null;
  const sessionStatus = sessionState(matchedSite);
  const handledUrl = useRef<string | null>(null);
  const adopted = useRef(false);

  /**
   * Arriving while an audit of this account is already running — from the shell's
   * running-audits pill, or simply by coming back — attaches to it.
   *
   * Without this the pill was a lie: it offered to take you back to a run and then landed
   * you on an empty form while the audit it was tracking finished somewhere off screen.
   * `adoptRunning` has always been able to do this; nothing called it unless the run had
   * been started by a website-card prefetch.
   *
   * Guarded by a ref rather than the effect's deps: it must happen once, on arrival, and
   * never fight the `?url=` branch below (which starts its own run) or a result the user
   * is already reading.
   */
  useEffect(() => {
    if (adopted.current || data || isPending) return;
    if (searchParams.get('url')) return;
    if (!useRunningAuditsStore.getState().runs.some(r => r.returnTo === '/app')) return;
    adopted.current = true;
    adoptRunning();
  }, [data, isPending, searchParams, adoptRunning]);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  /**
   * The query is an instruction — "audit this now" — so it is consumed once it has been
   * carried out, leaving a plain `/app` in the address bar.
   *
   * Without that, the instruction is still sitting there afterwards and *every* reload
   * repeats it. Someone who pressed Stop and then reloaded — or whose page reloaded on its
   * own, which is what Vite does to an open tab whenever a module cannot be hot-swapped —
   * got a brand new audit and the very reasonable impression that Stop had done nothing.
   *
   * `?audit=` survives: it names a finding inside a report rather than asking for work, and
   * a link to one has to keep working when the page is reloaded.
   */
  const consumeStartParams = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const key of ['url', 'prefill', 'projectId', 'ff']) next.delete(key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    const ff = searchParams.get('ff');
    if (ff === 'mobile' || ff === 'desktop') setFormFactor(ff);

    const paramUrl  = searchParams.get('url');
    const projectId = searchParams.get('projectId') ?? undefined;
    if (!paramUrl || paramUrl === handledUrl.current) return;
    handledUrl.current = paramUrl;
    setUrl(paramUrl);
    consumeStartParams();

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
    const mode = useAuditModeStore.getState();
    analyze(normalized, projectId, (ff === 'mobile' || ff === 'desktop') ? ff : mode.formFactor, mode.precision);
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
      analyze(target, projectId, next, precision);
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
      analyze(normalized, projectId, formFactor, precision);
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
      toast.success('Share link copied', {
        description: 'Anyone with the link can read this report — no account needed.',
        action: { label: 'Open it', onClick: () => window.open(link, '_blank', 'noopener') },
      });
    } catch {
      // History persists asynchronously right after an audit — a retry moment later succeeds,
      // which used to be something the user had to guess.
      setShareState('idle');
      toast.error('Could not create the share link', {
        description: 'This audit is still being saved. Try again in a moment.',
      });
    }
  }

  function handleExport() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    // getHostname, not a bare `new URL()` — a malformed stored URL would throw here and
    // turn the export button into a silent no-op.
    downloadBlob(blob, `perfscope-${getHostname(data.url)}-${Date.now()}.json`);
  }

  async function handleImage() {
    if (!data) return;
    downloadBlob(await shareCardBlob(data), shareCardFilename(data));
  }

  /**
   * The card onto the clipboard, for the far more common case than saving a file: pasting
   * it straight into a chat or a pull request.
   *
   * Returns whether it worked instead of throwing. Clipboard image writes are refused
   * outright by some browsers and by any page not on a secure origin, and that is a
   * limitation to report quietly, not an error to surface as a failure.
   */
  async function handleCopyImage(): Promise<boolean> {
    if (!data) return false;
    try {
      const blob = await shareCardBlob(data);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return true;
    } catch {
      toast.info('This browser will not let a page copy an image — download it instead.');
      return false;
    }
  }

  // Once a result is on screen the analyzer is about that page. Before that it is a form,
  // and account-wide advice is the more useful thing to have beside it.
  useAdviceContext(data ? { scope: 'site', url: data.url, label: getHostname(data.url) } : null);

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

    <Page className="space-y-8">
      <AnalyzerHeader
        hasData={!!data}
        onExport={handleExport}
        onImage={() => void handleImage()}
        onCopyImage={handleCopyImage}
        onPdf={() => window.print()}
        onAuthModal={() => setAuthModalOpen(true)}
        onShare={handleShare}
        shareState={shareState}
      />

      <AnalyzerSearchForm
        url={url}
        setUrl={setUrl}
        startedAt={startedAt}
        onCancel={cancel}
        suggestions={suggestions}
        isPending={isPending}
        authSessionId={authSessionId}
        sessionStatus={sessionStatus}
        progress={progress}
        formFactor={formFactor}
        onFormFactor={handleFormFactor}
        precision={precision}
        onPrecision={setPrecision}
        onSubmit={handleSubmit}
        onFixSession={() => setAuthModalOpen(true)}
      />

      {isError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-3 pt-4 pb-4 text-destructive flex-wrap">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-sm flex-1 min-w-[240px]">{error ?? 'Analysis failed'}</p>

            {/* An expired session is the one failure with a known repair, and it was being
                reported as plain text: the audit had already dropped the dead session, so
                the user's only route back was hunting for "Locked Page?" in the header. */}
            {errorCode === 'SESSION_EXPIRED' && (
              <Button
                type="button"
                variant="destructive-soft"
                size="sm"
                className="shrink-0"
                onClick={() => setAuthModalOpen(true)}
              >
                <Lock />
                Log in again
              </Button>
            )}
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

      {/* Idle: the page below the form was otherwise blank on first visit — and after a
          failed run, which used to leave the error card alone on an empty page with no
          way forward. The site shortcuts are exactly what a failed attempt needs. */}
      {!isPending && !data && (
        <AnalysisIdlePanel
          variant="analyze"
          sites={websites}
          onPick={setUrl}
          state={isError ? 'failed' : 'idle'}
        />
      )}

      <AnimatePresence>
        {data && <AnalyzerResultsPanel data={data} aiPending={aiPending} durationMs={durationMs} askEnabled />}
      </AnimatePresence>
    </Page>
    </>
  );
}
