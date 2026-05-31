import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useMotionValue } from 'framer-motion';
import { motion } from 'framer-motion';
import { Layers, Zap, Play, Pause, Clock } from 'lucide-react';
import type { AnalysisResult } from '@/entities/analysis';
import { TimelineProvider } from '../../analyzer/context/TimelineContext';
import { ResourceWaterfall } from '../../analyzer/components/ResourceWaterfall';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  background:           'var(--ps-panel-bg)',
  backdropFilter:       'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border:               '1px solid var(--ps-panel-border)',
  borderRadius:         '1rem',
  overflow:             'hidden',
};

const T_HEX   = '#8B5CF6';
const C_HEX   = '#F59E0B';
const T_GLOW  = 'rgba(139,92,246,0.55)';
const DIVIDER = 'var(--ps-divider)';
const CRIT    = '#ef4444';
const CRIT_G  = 'rgba(239,68,68,0.75)';
const TICK_MS = 50;

const fmt = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;

// ─── SideLabelBar ─────────────────────────────────────────────────────────────

function SideLabelBar({
  label, accent, reqCount, critCount,
}: {
  label: string; accent: string; reqCount: number; critCount: number;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2"
      style={{ background: `${accent}0a`, borderBottom: `1px solid ${DIVIDER}` }}
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accent }}>
          {label}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
          {reqCount} requests
        </span>
        {critCount > 0 && (
          <span className="flex items-center gap-1 text-[9px] font-bold" style={{ color: CRIT }}>
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: CRIT, boxShadow: `0 0 4px ${CRIT_G}` }}
            />
            {critCount} render-blocking
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function WaterfallComparison({
  target, competitor,
}: {
  target: AnalysisResult; competitor: AnalysisResult;
}) {
  // ── Derived data — keep before hooks for useMemo deps ──────────────────────
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

  // ── Playback state ─────────────────────────────────────────────────────────
  const sharedMotionMs = useMotionValue(0);
  const [currentMs,  setCurrentMs]  = useState(0);
  const [isPlaying,  setIsPlaying]  = useState(false);

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const playTimeRef  = useRef(0);

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
    isPlaying ? stopPlayback() : startPlayback();
  }, [isPlaying, stopPlayback, startPlayback]);

  // ── Guard — after all hooks ────────────────────────────────────────────────
  if (tReqs.length === 0 && cReqs.length === 0) return null;

  const pct = (ms: number) => `${((ms / totalMs) * 100).toFixed(2)}%`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={PANEL}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: `1px solid ${DIVIDER}` }}
      >
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>
            Waterfall Timeline Comparison
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
          >
            Synchronized Playback
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
          <span
            className="w-2 h-2 rounded-sm inline-block"
            style={{ border: `1px solid ${CRIT}`, boxShadow: `0 0 4px ${CRIT_G}` }}
          />
          render-blocking
        </div>
      </div>

      {/* ── Senior Insight Badge ── */}
      <div
        className="mx-6 mt-4 mb-3 px-4 py-3 rounded-xl flex items-start gap-3"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(139,92,246,0.06))',
          border:     '1px solid rgba(99,102,241,0.22)',
        }}
      >
        <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#818cf8' }} />
        <div>
          <span
            className="text-[9px] font-bold uppercase tracking-widest block mb-0.5"
            style={{ color: '#818cf8' }}
          >
            Senior Insight
          </span>
          <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.70)' }}>
            Your site uses{' '}
            <span style={{ color: T_HEX, fontWeight: 700 }}>Parallel Fetching (HTTP/2-3)</span>
            {' '}vs Competitor's{' '}
            <span style={{ color: CRIT, fontWeight: 700 }}>Sequential Bottleneck</span>
            {' '}— resources load simultaneously rather than waiting in queue.
          </p>
        </div>
      </div>

      {/* ── Dual Waterfall (shared TimelineContext) ── */}
      <TimelineProvider sharedMotionMs={sharedMotionMs}>
        <div
          className="grid"
          style={{ gridTemplateColumns: '1fr 1fr', borderTop: `1px solid ${DIVIDER}` }}
        >
          {/* Your Site */}
          <div style={{ borderRight: `1px solid ${DIVIDER}` }}>
            <SideLabelBar
              label="Your Site" accent={T_HEX}
              reqCount={tReqs.length} critCount={tCrit}
            />
            {target.resources ? (
              <ResourceWaterfall
                resources={target.resources}
                timelineDuration={totalMs}
              />
            ) : (
              <div className="px-6 py-8 text-center text-[11px]"
                style={{ color: 'rgba(255,255,255,0.25)' }}>
                No resource data
              </div>
            )}
          </div>

          {/* Competitor */}
          <div>
            <SideLabelBar
              label="Competitor" accent={C_HEX}
              reqCount={cReqs.length} critCount={cCrit}
            />
            {competitor.resources ? (
              <ResourceWaterfall
                resources={competitor.resources}
                timelineDuration={totalMs}
              />
            ) : (
              <div className="px-6 py-8 text-center text-[11px]"
                style={{ color: 'rgba(255,255,255,0.25)' }}>
                No resource data
              </div>
            )}
          </div>
        </div>
      </TimelineProvider>

      {/* ── Shared Scrubber ── */}
      <div
        className="px-6 py-4 space-y-2"
        style={{ borderTop: `1px solid ${DIVIDER}` }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
            style={{
              background: isPlaying ? T_HEX : 'rgba(255,255,255,0.08)',
              border:     `1px solid ${isPlaying ? T_HEX : 'rgba(255,255,255,0.12)'}`,
              boxShadow:  isPlaying ? `0 0 12px ${T_GLOW}` : 'none',
            }}
          >
            {isPlaying
              ? <Pause className="w-3 h-3 text-white" />
              : <Play  className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.65)' }} />}
          </button>

          <div className="relative flex-1">
            <input
              type="range"
              min={0} max={totalMs} step={16}
              value={currentMs}
              onChange={e => seek(Number(e.target.value))}
              className="w-full appearance-none h-1.5 rounded-full outline-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${T_HEX} ${pct(currentMs)}, rgba(255,255,255,0.12) ${pct(currentMs)})`,
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full pointer-events-none"
              style={{
                left:       pct(currentMs),
                background: '#ffffff',
                boxShadow:  `0 0 8px ${T_GLOW}`,
                border:     `2px solid ${T_HEX}`,
              }}
            />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.35)' }} />
            <span className="text-[11px] font-mono tabular-nums" style={{ color: 'rgba(255,255,255,0.60)' }}>
              {fmt(currentMs)}
            </span>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
              / {fmt(totalMs)}
            </span>
          </div>
        </div>

        <div className="flex justify-between" style={{ paddingLeft: 40, paddingRight: 80 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="text-[8px] tabular-nums" style={{ color: 'rgba(255,255,255,0.18)' }}>
              {fmt((i / 4) * totalMs)}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
