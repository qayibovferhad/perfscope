import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Page } from '@/shared/ui/page';
import { Link, useSearchParams } from 'react-router-dom';
import { consumeComparePreload } from '@/features/compare';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, RotateCcw, History } from 'lucide-react';
import { apiClient } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { normalizeUrl } from '@/shared/lib/utils';
import { useComparisonSide } from '@/features/compare';
import { useWebsites } from '@/entities/website';
import { useAuditModeStore, FormFactorToggle, PrecisionToggle } from '@/entities/analysis';
import { useCompetitorSessions } from '@/features/compare';
import { SideInputBar } from '@/features/compare';
import { ComparisonScoreboard } from './ui/ComparisonScoreboard';
import { DeepComparison } from './ui/DeepComparison';
import { AiCard } from '@/shared/ui/ai-card';
import { PageHeader } from '@/shared/ui/page';
import { ComparisonEngine } from './ui/ComparisonEngine';
import { FilmstripComparison } from './ui/FilmstripComparison';
import { WaterfallComparison } from './ui/WaterfallComparison';
import { ComparisonSide } from './ui/ComparisonSide';
import { AnalysisIdlePanel } from '@/widgets/analysis-idle';

export function ComparisonPage() {
  const target     = useComparisonSide();
  const competitor = useComparisonSide();

  const [searchParams] = useSearchParams();
  const prefilledUrl = searchParams.get('url') ?? '';

  const [targetUrl,     setTargetUrl]     = useState(prefilledUrl || 'https://');
  const [competitorUrl, setCompetitorUrl] = useState('https://');

  const [targetAuthSession,     setTargetAuthSession]     = useState<string | null>(null);
  const [competitorAuthSession, setCompetitorAuthSession] = useState<string | null>(null);

  const { websites } = useWebsites();
  const { sessions: competitorSessions } = useCompetitorSessions();
  const urlHasSavedSession = (url: string) =>
    websites.some(w => url.startsWith(w.url) && !!w.session) ||
    competitorSessions.some(c => url.startsWith(c.url) && !!c.session);

  const handleTargetUrlChange = (val: string) => {
    if (prefilledUrl && !val.startsWith(prefilledUrl)) return;
    setTargetUrl(val);
  };

  const savedRef = useRef(false);
  // Gemini's read on the matchup. `pending` runs from the moment both sides are in until
  // the save responds — the same skeleton-then-content contract the analyzer uses.
  const [verdict, setVerdict] = useState<{ text: string | null; pending: boolean }>({ text: null, pending: false });

  useLayoutEffect(() => {
    const preload = consumeComparePreload();
    if (!preload) return;
    target.setData(preload.target);
    competitor.setData(preload.competitor);
    setTargetUrl(preload.target.url ?? '');
    setCompetitorUrl(preload.competitor.url ?? '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isRunning  = target.isLoading || competitor.isLoading;
  const bothLoaded = target.isSuccess  && competitor.isSuccess;

  useEffect(() => {
    if (bothLoaded && target.data && competitor.data && !savedRef.current) {
      savedRef.current = true;
      setVerdict({ text: null, pending: true });
      apiClient.post<{ aiVerdict?: string | null }>('/compare-history', {
        sourceUrl:  target.data.url,
        targetUrl:  competitor.data.url,
        source:     { scores: target.data.scores, metrics: target.data.metrics },
        competitor: { scores: competitor.data.scores, metrics: competitor.data.metrics },
      })
        .then((res) => setVerdict({ text: res.data?.aiVerdict ?? null, pending: false }))
        // Signed out, or no storage: there is no verdict and no way to get one. Drop the
        // skeleton rather than leaving it pulsing over a comparison that is otherwise fine.
        .catch(() => setVerdict({ text: null, pending: false }));
    }
  }, [bothLoaded, target.data, competitor.data]);

  const isBlank = (u: string) => u.trim() === '' || u.trim() === 'https://';
  const targetReady     = !isBlank(targetUrl)     || target.isSuccess;
  const competitorReady = !isBlank(competitorUrl) || competitor.isSuccess;
  const canLaunch       = targetReady && competitorReady && !isRunning && !bothLoaded;

  // Both sides always share one device profile — a desktop run against a mobile one is
  // not a comparison. Read from the same persisted store the analyzer uses.
  const { formFactor, setFormFactor, precision, setPrecision } = useAuditModeStore();

  const handleLaunch = () => {
    if (!target.isSuccess && !isBlank(targetUrl)) {
      if (targetAuthSession) target.startAuthAudit(targetAuthSession, normalizeUrl(targetUrl), formFactor);
      else                   target.analyze(normalizeUrl(targetUrl), formFactor, precision);
    }
    if (!competitor.isSuccess && !isBlank(competitorUrl)) {
      if (competitorAuthSession) competitor.startAuthAudit(competitorAuthSession, normalizeUrl(competitorUrl), formFactor);
      else                       competitor.analyze(normalizeUrl(competitorUrl), formFactor, precision);
    }
  };

  const handleResetAll = () => {
    setVerdict({ text: null, pending: false });
    target.reset();
    competitor.reset();
    setTargetUrl('https://');
    setCompetitorUrl('https://');
    setTargetAuthSession(null);
    setCompetitorAuthSession(null);
    savedRef.current = false;
  };

  return (
    <Page width="wide" className="space-y-6">

      <PageHeader
        eyebrow="Compare"
        title="Competitive analysis"
        description="Audit two pages side by side — scores, vitals, filmstrip and request waterfall."
        className="mb-0"
        actions={
          <>
            <Button variant="outline" size="sm" asChild
                    className="gap-2 text-ld-text-2 border-ld-border-strong">
              <Link to="/compare-history">
                <History className="w-[15px] h-[15px]" />
                Compare History
              </Link>
            </Button>
            {bothLoaded && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetAll}
                className="gap-2 text-ld-text-2 border-ld-border-strong"
              >
                <RotateCcw className="w-[15px] h-[15px]" />
                Reset All
              </Button>
            )}
          </>
        }
      />

      {/* ── URL cards — 2-column grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
        <SideInputBar
          side="target"
          url={targetUrl}
          onUrlChange={handleTargetUrlChange}
          isLoading={target.isLoading}
          isSuccess={target.isSuccess}
          isError={target.isError}
          error={target.error}
          progress={target.progress}
          data={target.data}
          onUpload={d => { target.setData(d); setTargetUrl(d.url ?? ''); }}
          onReset={() => { target.reset(); setTargetUrl(prefilledUrl || ''); }}
          onAuthAudit={(sessionId, auditUrl) => { setTargetUrl(auditUrl); setTargetAuthSession(sessionId); }}
          hasAuthSession={!!targetAuthSession || urlHasSavedSession(targetUrl)}
        />
        <SideInputBar
          side="competitor"
          url={competitorUrl}
          onUrlChange={setCompetitorUrl}
          isLoading={competitor.isLoading}
          isSuccess={competitor.isSuccess}
          isError={competitor.isError}
          error={competitor.error}
          progress={competitor.progress}
          data={competitor.data}
          onUpload={d => { competitor.setData(d); setCompetitorUrl(d.url ?? ''); }}
          onReset={() => { competitor.reset(); setCompetitorUrl(''); }}
          onAuthAudit={(sessionId, auditUrl) => { setCompetitorUrl(auditUrl); setCompetitorAuthSession(sessionId); }}
          hasAuthSession={!!competitorAuthSession || urlHasSavedSession(competitorUrl)}
        />
      </div>

      {/* ── Launch + progress strip ────────────────────────────────────────── */}
      {!bothLoaded && (
        <div className="flex flex-col items-center gap-3">
          {/* Same pair of choices as the analyzer, and stored in the same place: a compare
              run was always single-shot, so its numbers could not be lined up against a
              precise run of the same page. */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <FormFactorToggle
              value={formFactor}
              onChange={setFormFactor}
              disabled={isRunning}
            />
            <PrecisionToggle
              value={precision}
              onChange={setPrecision}
              disabled={isRunning}
            />
          </div>

          <Button
            size="lg"
            disabled={!canLaunch}
            onClick={handleLaunch}
            className="gap-2.5 px-8 font-semibold disabled:opacity-40"
          >
            <Zap className="w-[17px] h-[17px]" />
            Launch Competitive Analysis
          </Button>

        </div>
      )}

      {/* Idle: everything below the launch button was otherwise blank on first visit */}
      {!isRunning && !bothLoaded && !target.data && !competitor.data && (
        <AnalysisIdlePanel
          variant="compare"
          sites={websites}
          // handleTargetUrlChange refuses anything off the prefilled URL, so a pick would
          // silently do nothing when the page was opened from a specific site. Fill the
          // side that is actually free.
          onPick={url => (prefilledUrl ? setCompetitorUrl(url) : setTargetUrl(url))}
        />
      )}

      {/* ── Scoreboard ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {bothLoaded && target.data && competitor.data && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <ComparisonScoreboard target={target.data} competitor={competitor.data} />
            {/* Directly under the scoreboard: it is the sentence the numbers above imply. */}
            <AiCard
              title="The verdict"
              text={verdict.text ?? undefined}
              pending={verdict.pending}
              className="mt-4"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Category Scores + Core Web Vitals ────────────────────────────── */}
      <AnimatePresence>
        {bothLoaded && target.data && competitor.data && (
          <ComparisonSide target={target.data} competitor={competitor.data} />
        )}
      </AnimatePresence>

      {/* ── Comparison Engine ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {bothLoaded && target.data && competitor.data && (
          <ComparisonEngine target={target.data} competitor={competitor.data} />
        )}
      </AnimatePresence>

      {/* ── Deep Comparison ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {bothLoaded && target.data && competitor.data && (
          <DeepComparison target={target.data} competitor={competitor.data} />
        )}
      </AnimatePresence>

      {/* ── Filmstrip Comparison ──────────────────────────────────────────── */}
      <AnimatePresence>
        {bothLoaded && target.data && competitor.data && (
          <FilmstripComparison target={target.data} competitor={competitor.data} />
        )}
      </AnimatePresence>

      {/* ── Waterfall Timeline Comparison ─────────────────────────────────── */}
      <AnimatePresence>
        {bothLoaded && target.data && competitor.data && (
          <WaterfallComparison target={target.data} competitor={competitor.data} />
        )}
      </AnimatePresence>
    </Page>
  );
}
