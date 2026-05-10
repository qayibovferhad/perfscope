import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMotionValue, motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, GitCompareArrows, Zap, RotateCcw, History } from 'lucide-react';
import { apiClient } from '@/api/client';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { Button } from '@/shared/components/ui/button';
import { useComparisonSide } from './hooks/useComparisonSide';
import { SideInputBar } from './components/SideInputBar';
import { ComparisonScoreboard } from './components/ComparisonScoreboard';
import { DeepComparison } from './components/DeepComparison';
import { ComparisonEngine } from './components/ComparisonEngine';
import { FilmstripComparison } from './components/FilmstripComparison';
import { WaterfallComparison } from './components/WaterfallComparison';
import { ComparisonSide } from './components/ComparisonSide';

function normalize(url: string): string {
  const t = url.trim();
  return t.startsWith('http') ? t : `https://${t}`;
}

export function ComparisonPage() {
  const target     = useComparisonSide();
  const competitor = useComparisonSide();

  const [targetUrl,     setTargetUrl]     = useState('https://');
  const [competitorUrl, setCompetitorUrl] = useState('https://');

  const sharedMotionMs = useMotionValue(0);
  const savedRef = useRef(false);

  const isRunning  = target.isLoading || competitor.isLoading;
  const bothLoaded = target.isSuccess  && competitor.isSuccess;

  // Auto-save to compare history when both sides complete
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

  // Enable launch when both sides have either a pending URL or already-loaded data
  const isBlank = (u: string) => u.trim() === '' || u.trim() === 'https://';
  const targetReady     = !isBlank(targetUrl)     || target.isSuccess;
  const competitorReady = !isBlank(competitorUrl) || competitor.isSuccess;
  const canLaunch       = targetReady && competitorReady && !isRunning && !bothLoaded;

  const handleLaunch = () => {
    if (!target.isSuccess && !isBlank(targetUrl)) {
      target.analyze(normalize(targetUrl));
    }
    if (!competitor.isSuccess && !isBlank(competitorUrl)) {
      competitor.analyze(normalize(competitorUrl));
    }
  };

  const handleResetAll = () => {
    target.reset();
    competitor.reset();
    setTargetUrl('https://');
    setCompetitorUrl('https://');
    savedRef.current = false;
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8 space-y-8">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground hover:text-foreground">
            <Link to="/app"><ArrowLeft className="w-3.5 h-3.5" /> Analyzer</Link>
          </Button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <GitCompareArrows className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Competitive Analysis</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Link to="/compare-history">
              <History className="w-3.5 h-3.5" /> Compare History
            </Link>
          </Button>
          {bothLoaded && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-muted-foreground"
              onClick={handleResetAll}>
              <RotateCcw className="w-3 h-3" /> Reset All
            </Button>
          )}
        </div>
      </div>

      {/* ── Input card ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-card overflow-hidden">
        <div className="grid lg:grid-cols-[1fr_1px_1fr]">

          {/* Left — Your Site */}
          <div className="px-8 pt-7 pb-6">
            <SideInputBar
              side="target"
              url={targetUrl}
              onUrlChange={setTargetUrl}
              isLoading={target.isLoading}
              isSuccess={target.isSuccess}
              isError={target.isError}
              error={target.error}
              progress={target.progress}
              data={target.data}
              onUpload={(d) => { target.setData(d); setTargetUrl(d.url ?? ''); }}
              onReset={() => { target.reset(); setTargetUrl(''); }}
            />
          </div>

          {/* Vertical divider */}
          <div className="hidden lg:block bg-white/[0.07]" />

          {/* Right — Competitor */}
          <div className="px-8 pt-7 pb-6 border-t border-white/[0.07] lg:border-t-0">
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
              onUpload={(d) => { competitor.setData(d); setCompetitorUrl(d.url ?? ''); }}
              onReset={() => { competitor.reset(); setCompetitorUrl(''); }}
            />
          </div>
        </div>

        {/* ── Launch button row ── */}
        {!bothLoaded && (
          <div className="flex items-center justify-center py-5 border-t border-white/[0.07] bg-white/[0.01]">
            <Button
              size="lg"
              disabled={!canLaunch}
              onClick={handleLaunch}
              className="gap-2.5 px-8 font-semibold disabled:opacity-40 transition-all"
              style={canLaunch ? {
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #f97316 100%)',
                boxShadow: '0 0 32px rgba(99,102,241,0.25)',
              } : undefined}
            >
              <Zap className="w-4 h-4" />
              Launch Competitive Analysis
            </Button>
          </div>
        )}

        {/* ── Dual loading progress bar ── */}
        <AnimatePresence>
          {isRunning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-white/[0.07]"
            >
              <div className="px-8 py-3 flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  {target.isLoading
                    ? <span className="animate-pulse">{target.progress?.message ?? 'Analyzing…'}</span>
                    : <span className="text-emerald-400">Ready</span>}
                </div>
                <div className="flex-1 h-px bg-white/10" />
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {competitor.isLoading
                    ? <span className="animate-pulse">{competitor.progress?.message ?? 'Analyzing…'}</span>
                    : <span className="text-emerald-400">Ready</span>}
                  <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                </div>
              </div>
              <DualProgressBar
                targetPct={target.progress?.progress ?? 0}
                competitorPct={competitor.progress?.progress ?? 0}
                targetDone={target.isSuccess}
                competitorDone={competitor.isSuccess}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Scoreboard ───────────────────────────────────────────────────── */}
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

      {/* ── Comparison Engine ────────────────────────────────────────────── */}
      <AnimatePresence>
        {bothLoaded && target.data && competitor.data && (
          <ComparisonEngine target={target.data} competitor={competitor.data} />
        )}
      </AnimatePresence>

      {/* ── Deep Comparison ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {bothLoaded && target.data && competitor.data && (
          <DeepComparison target={target.data} competitor={competitor.data} />
        )}
      </AnimatePresence>

      {/* ── Filmstrip Comparison ─────────────────────────────────────────── */}
      <AnimatePresence>
        {bothLoaded && target.data && competitor.data && (
          <FilmstripComparison target={target.data} competitor={competitor.data} />
        )}
      </AnimatePresence>

      {/* ── Waterfall Timeline Comparison ────────────────────────────────── */}
      <AnimatePresence>
        {bothLoaded && target.data && competitor.data && (
          <WaterfallComparison target={target.data} competitor={competitor.data} />
        )}
      </AnimatePresence>

      {/* ── Side-by-side visualizations ──────────────────────────────────── */}
      <AnimatePresence>
        {bothLoaded && target.data && competitor.data && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
            className="space-y-4"
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <ComparisonSide
                side="target"
                data={target.data}
                sharedMotionMs={sharedMotionMs}
                onData={target.setData}
                onReset={target.reset}
              />
              <ComparisonSide
                side="competitor"
                data={competitor.data}
                sharedMotionMs={sharedMotionMs}
                onData={competitor.setData}
                onReset={competitor.reset}
              />
            </div>
            <p className="text-center text-[11px] text-muted-foreground/35">
              Click any point on the memory charts to sync the timeline cursor across both sides simultaneously.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Dual progress bar ─────────────────────────────────────────────────────────

function DualProgressBar({
  targetPct, competitorPct, targetDone, competitorDone,
}: {
  targetPct: number; competitorPct: number;
  targetDone: boolean; competitorDone: boolean;
}) {
  const tPct = targetDone     ? 100 : targetPct;
  const cPct = competitorDone ? 100 : competitorPct;

  return (
    <div className="px-8 pb-4 space-y-1.5">
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-indigo-500"
          animate={{ width: `${tPct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-orange-500"
          animate={{ width: `${cPct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
