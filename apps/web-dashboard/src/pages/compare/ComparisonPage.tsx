import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { consumeComparePreload } from '@/features/compare/model/comparePreloadStore';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, GitCompareArrows, Zap, RotateCcw, History } from 'lucide-react';
import { apiClient } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { normalizeUrl } from '@/shared/lib/utils';
import { useComparisonSide } from '@/features/compare/model/useComparisonSide';
import { useWebsites } from '@/entities/website';
import { useAuditModeStore } from '@/entities/analysis/model/auditModeStore';
import { FormFactorToggle } from '@/entities/analysis/ui/FormFactorToggle';
import { useCompetitorSessions } from '@/features/compare/model/useCompetitorSessions';
import { SideInputBar } from '@/features/compare/ui/SideInputBar';
import { ComparisonScoreboard } from './ui/ComparisonScoreboard';
import { DeepComparison } from './ui/DeepComparison';
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
      apiClient.post('/compare-history', {
        sourceUrl:  target.data.url,
        targetUrl:  competitor.data.url,
        source:     { scores: target.data.scores, metrics: target.data.metrics },
        competitor: { scores: competitor.data.scores, metrics: competitor.data.metrics },
      }).catch(() => {});
    }
  }, [bothLoaded, target.data, competitor.data]);

  const isBlank = (u: string) => u.trim() === '' || u.trim() === 'https://';
  const targetReady     = !isBlank(targetUrl)     || target.isSuccess;
  const competitorReady = !isBlank(competitorUrl) || competitor.isSuccess;
  const canLaunch       = targetReady && competitorReady && !isRunning && !bothLoaded;

  // Both sides always share one device profile — a desktop run against a mobile one is
  // not a comparison. Read from the same persisted store the analyzer uses.
  const { formFactor, setFormFactor } = useAuditModeStore();

  const handleLaunch = () => {
    if (!target.isSuccess && !isBlank(targetUrl)) {
      if (targetAuthSession) target.startAuthAudit(targetAuthSession, normalizeUrl(targetUrl), formFactor);
      else                   target.analyze(normalizeUrl(targetUrl), formFactor);
    }
    if (!competitor.isSuccess && !isBlank(competitorUrl)) {
      if (competitorAuthSession) competitor.startAuthAudit(competitorAuthSession, normalizeUrl(competitorUrl), formFactor);
      else                       competitor.analyze(normalizeUrl(competitorUrl), formFactor);
    }
  };

  const handleResetAll = () => {
    target.reset();
    competitor.reset();
    setTargetUrl('https://');
    setCompetitorUrl('https://');
    setTargetAuthSession(null);
    setCompetitorAuthSession(null);
    savedRef.current = false;
  };

  return (
    <div className="max-w-[1400px] mx-auto px-[clamp(18px,3vw,40px)] py-8 space-y-6">

      {/* ── Top bar — breadcrumb + actions ────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        <nav className="flex items-center gap-[10px] text-[14px]">
          <Link
            to="/websites"
            className="inline-flex items-center gap-[7px] text-ld-text-3 font-medium transition-colors hover:text-ld-accent"
          >
            <LayoutGrid className="w-[15px] h-[15px]" />
            Websites
          </Link>
          <span className="text-ld-text-3 opacity-50">/</span>
          <span className="inline-flex items-center gap-[7px] text-ld-text font-semibold">
            <GitCompareArrows className="w-[16px] h-[16px] text-ld-accent" />
            Competitive Analysis
          </span>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-2 text-ld-text-2 border-ld-border-strong"
          >
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
        </div>
      </div>

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
          <FormFactorToggle
            value={formFactor}
            onChange={setFormFactor}
            disabled={isRunning}
          />

          <Button
            size="lg"
            disabled={!canLaunch}
            onClick={handleLaunch}
            className="gap-2.5 px-8 font-semibold disabled:opacity-40"
          >
            <Zap className="w-[17px] h-[17px]" />
            Launch Competitive Analysis
          </Button>

          {/* <AnimatePresence>
            {isRunning && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full max-w-[520px] overflow-hidden"
              >
                <div className="flex items-center justify-between text-[11.5px] mb-2 px-1">
                  <span className="flex items-center gap-[7px]">
                    <span className="w-2 h-2 rounded-full bg-ld-accent shrink-0" />
                    <span className={target.isLoading ? 'text-ld-text-3 animate-pulse' : 'text-ld-accent-2'}>
                      {target.isLoading ? (target.progress?.message ?? 'Analyzing…') : 'Ready'}
                    </span>
                  </span>
                  <span className="flex items-center gap-[7px]">
                    <span className={competitor.isLoading ? 'text-ld-text-3 animate-pulse' : 'text-ld-amber'}>
                      {competitor.isLoading ? (competitor.progress?.message ?? 'Analyzing…') : 'Ready'}
                    </span>
                    <span className="w-2 h-2 rounded-full shrink-0 bg-ld-amber" />
                  </span>
                </div>
                <DualProgressBar
                  targetPct={target.progress?.progress ?? 0}
                  competitorPct={competitor.progress?.progress ?? 0}
                  targetDone={target.isSuccess}
                  competitorDone={competitor.isSuccess}
                />
              </motion.div>
            )}
          </AnimatePresence> */}
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
    </div>
  );
}
