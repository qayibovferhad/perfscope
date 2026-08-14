import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useMotionValue, motion } from 'framer-motion';
import { Activity, Zap } from 'lucide-react';
import type { AnalysisResult } from '@/entities/analysis';
import { TimelineProvider } from '@/features/analyzer/model/TimelineContext';
import { ResourceWaterfall } from '@/features/analyzer/ui/ResourceWaterfall';
import { fmtMs } from '@/shared/lib/format';
import { TransportBar } from './TransportBar';

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_MS = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maxConcurrent(reqs: { startTime: number; endTime: number }[]): number {
  if (!reqs.length) return 0;
  const evts: { t: number; d: 1 | -1 }[] = [];
  for (const r of reqs) {
    evts.push({ t: r.startTime, d: 1 }, { t: r.endTime, d: -1 });
  }
  evts.sort((a, b) => a.t - b.t);
  let max = 0, cur = 0;
  for (const e of evts) { cur += e.d; max = Math.max(max, cur); }
  return max;
}

// ─── Insight note ─────────────────────────────────────────────────────────────

function InsightNote({
  tConc, cConc, tCrit, cCrit,
}: {
  tConc: number; cConc: number; tCrit: number; cCrit: number;
}) {
  const youParallel   = tConc >= 4;
  const rivalParallel = cConc >= 4;

  let body: React.ReactNode;

  if (youParallel && !rivalParallel) {
    body = (
      <>
        <b className="font-bold text-ld-accent-2">Your site loads in parallel (HTTP/2-3)</b>
        {' '}while the competitor hits a{' '}
        <b className="font-bold text-ld-amber">sequential bottleneck</b>
        {' '}— your resources fetch simultaneously rather than waiting in a chain.
      </>
    );
  } else if (!youParallel && rivalParallel) {
    body = (
      <>
        The competitor benefits from{' '}
        <b className="font-bold text-ld-amber">parallel loading (HTTP/2-3)</b>
        {' '}while your site has a{' '}
        <b className="font-bold text-ld-accent-2">sequential load chain</b>
        {' '}— enabling HTTP/2 on your server can unlock simultaneous fetching.
      </>
    );
  } else if (tCrit === 0 && cCrit > 0) {
    body = (
      <>
        <b className="font-bold text-ld-accent-2">Your site has zero render-blocking resources</b>
        {' '}while the competitor has{' '}
        <b className="font-bold text-ld-amber">
          {cCrit} render-blocking {cCrit === 1 ? 'resource' : 'resources'}
        </b>
        {' '}delaying first paint.
      </>
    );
  } else if (cCrit === 0 && tCrit > 0) {
    body = (
      <>
        The competitor has{' '}
        <b className="font-bold text-ld-amber">zero render-blocking resources</b>
        {' '}while your site has{' '}
        <b className="font-bold text-ld-accent-2">
          {tCrit} render-blocking {tCrit === 1 ? 'resource' : 'resources'}
        </b>
        {' '}— consider deferring or inlining critical CSS/JS.
      </>
    );
  } else {
    body = (
      <>
        Your site peaks at{' '}
        <b className="font-bold text-ld-accent-2">{tConc} concurrent requests</b>
        {' '}vs{' '}
        <b className="font-bold text-ld-amber">{cConc} for the competitor</b>
        {' '}— higher concurrency generally means faster perceived load time.
      </>
    );
  }

  return (
    <div className="flex items-start gap-[11px] px-[16px] py-[14px] rounded-[12px] border border-ld-border bg-ld-surface-2 mb-[20px] text-[13.5px] leading-[1.5] text-ld-text-2">
      <Zap className="w-[18px] h-[18px] text-ld-accent shrink-0 mt-0.5" />
      <span>{body}</span>
    </div>
  );
}

// ─── Side head ────────────────────────────────────────────────────────────────

function SideHead({
  isYou, reqCount, critCount, concurrent,
}: {
  isYou: boolean; reqCount: number; critCount: number; concurrent: number;
}) {
  const meta = critCount > 0
    ? `${critCount} render-blocking`
    : concurrent >= 4 ? 'parallel (HTTP/2-3)' : 'sequential';

  return (
    <div className="flex items-center justify-between mb-[10px]">
      <span className={`inline-flex items-center gap-[8px] font-mono text-[12px] font-semibold tracking-[.08em] uppercase ${isYou ? 'text-ld-accent-2' : 'text-ld-amber'}`}>
        <span className={`w-[9px] h-[9px] rounded-full shrink-0 ${isYou ? 'bg-ld-accent' : 'bg-ld-amber'}`} />
        {isYou ? 'Your Site' : 'Competitor'}
      </span>
      <span className="font-mono text-[11px] text-ld-text-3">
        {reqCount} req · <span className={critCount > 0 ? 'text-ld-rose' : ''}>{meta}</span>
      </span>
    </div>
  );
}

// ─── Waterfall box ────────────────────────────────────────────────────────────

function WfBox({
  reqCount, totalMs, empty, children,
}: {
  reqCount: number; totalMs: number; empty: boolean; children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-ld-border overflow-hidden">
      <div className="flex items-center gap-[9px] px-[14px] py-[11px] border-b border-ld-border bg-ld-surface-2">
        <Activity className="w-[15px] h-[15px] text-ld-text-3" />
        <b className="font-mono text-[12px] font-semibold text-ld-text-2">Network Waterfall</b>
        <span className="ml-auto font-mono text-[11px] text-ld-text-3">
          {reqCount} req · {fmtMs(totalMs)}
        </span>
      </div>
      {empty
        ? <div className="px-6 py-8 text-center text-[11px] text-ld-text-3">No resource data</div>
        : children}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function WaterfallComparison({
  target, competitor,
}: {
  target: AnalysisResult; competitor: AnalysisResult;
}) {
  // ── Derived data ───────────────────────────────────────────────────────────
  const tReqs = useMemo(
    () => (target.resources?.requests ?? []).filter(r => r.endTime > r.startTime),
    [target],
  );
  const cReqs = useMemo(
    () => (competitor.resources?.requests ?? []).filter(r => r.endTime > r.startTime),
    [competitor],
  );

  const tCrit  = useMemo(() => tReqs.filter(r => r.isCritical).length, [tReqs]);
  const cCrit  = useMemo(() => cReqs.filter(r => r.isCritical).length, [cReqs]);
  const tMax   = useMemo(() => tReqs.reduce((m, r) => Math.max(m, r.endTime), 0), [tReqs]);
  const cMax   = useMemo(() => cReqs.reduce((m, r) => Math.max(m, r.endTime), 0), [cReqs]);
  const totalMs = Math.max(tMax, cMax, 1);

  const tConc = useMemo(() => maxConcurrent(tReqs), [tReqs]);
  const cConc = useMemo(() => maxConcurrent(cReqs), [cReqs]);

  // ── Playback state ─────────────────────────────────────────────────────────
  const sharedMotionMs = useMotionValue(0);
  const [currentMs, setCurrentMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playTimeRef = useRef(0);

  const stopPlayback = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (playTimeRef.current >= totalMs) playTimeRef.current = 0;
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      playTimeRef.current = Math.min(playTimeRef.current + TICK_MS, totalMs);
      sharedMotionMs.set(playTimeRef.current);
      setCurrentMs(playTimeRef.current);
      if (playTimeRef.current >= totalMs) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setIsPlaying(false);
      }
    }, TICK_MS);
  }, [totalMs, sharedMotionMs]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const seek = useCallback((ms: number) => {
    stopPlayback();
    playTimeRef.current = ms;
    sharedMotionMs.set(ms);
    setCurrentMs(ms);
  }, [stopPlayback, sharedMotionMs]);

  const togglePlay = useCallback(() => {
    if (isPlaying) stopPlayback();
    else startPlayback();
  }, [isPlaying, stopPlayback, startPlayback]);

  // ── Guard — after all hooks ────────────────────────────────────────────────
  if (tReqs.length === 0 && cReqs.length === 0) return null;


  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-[20px] border border-ld-border bg-ld-surface shadow-ld-shadow-card p-[26px]"
    >
      {/* ── Section head ── */}
      <div className="flex items-center gap-[11px] mb-[22px]">
        <div className="w-8 h-8 rounded-[9px] grid place-items-center bg-ld-surface-2 border border-ld-border text-ld-accent shrink-0">
          <Activity className="w-[16px] h-[16px]" />
        </div>
        <h2 className="text-[16px] font-bold tracking-[-0.01em] text-ld-text">Waterfall Timeline</h2>
        <span className="font-mono text-[10.5px] font-semibold px-[9px] py-[4px] rounded-[6px] border border-ld-accent-line bg-ld-accent-soft text-ld-accent-2">
          Network
        </span>
      </div>

      {/* ── Insight note ── */}
      <InsightNote tConc={tConc} cConc={cConc} tCrit={tCrit} cCrit={cCrit} />

      {/* ── Dual waterfall ── */}
      <TimelineProvider sharedMotionMs={sharedMotionMs}>
        <div className="grid grid-cols-2 gap-[16px] max-[1080px]:grid-cols-1">

          {/* You */}
          <div>
            <SideHead isYou reqCount={tReqs.length} critCount={tCrit} concurrent={tConc} />
            <WfBox reqCount={tReqs.length} totalMs={tMax} empty={!target.resources}>
              <ResourceWaterfall resources={target.resources!} timelineDuration={totalMs} showHeader={false} />
            </WfBox>
          </div>

          {/* Competitor */}
          <div>
            <SideHead isYou={false} reqCount={cReqs.length} critCount={cCrit} concurrent={cConc} />
            <WfBox reqCount={cReqs.length} totalMs={cMax} empty={!competitor.resources}>
              <ResourceWaterfall resources={competitor.resources!} timelineDuration={totalMs} showHeader={false} />
            </WfBox>
          </div>

        </div>
      </TimelineProvider>

      {/* ── Scrubber ── */}
      <div className="border-t border-ld-border mt-5 pt-4 space-y-2">
        <TransportBar
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          currentMs={currentMs}
          totalMs={totalMs}
          onSeek={seek}
          format={fmtMs}
        />

        <div className="flex justify-between pl-10 pr-20">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="text-[8px] tabular-nums text-ld-text-3 opacity-60">
              {fmtMs((i / 4) * totalMs)}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
