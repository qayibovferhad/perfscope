import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Film } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { TimelineData, TimelineFrame } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const METRICS = [
  { key: 'fcp' as const, label: 'FCP', bg: 'bg-blue-500',   text: 'text-blue-400',  border: 'border-blue-500',  hex: '#3b82f6' },
  { key: 'lcp' as const, label: 'LCP', bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500', hex: '#10b981' },
  { key: 'tti' as const, label: 'TTI', bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500', hex: '#f97316' },
];

// Filmstrip thumb dimensions (≈3× the old 72×52)
const THUMB_W = 192;
const THUMB_H = 140;

// ─── Utilities ────────────────────────────────────────────────────────────────

function findClosestFrameIndex(frames: TimelineFrame[], targetMs: number): number {
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].timing < targetMs) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(frames[lo - 1].timing - targetMs) < Math.abs(frames[lo].timing - targetMs)) {
    return lo - 1;
  }
  return lo;
}

function fmt(ms: number) {
  return (ms / 1000).toFixed(2) + 's';
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function PerformanceTimelineSkeleton() {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40 bg-slate-800" />
        <Skeleton className="h-7 w-28 bg-slate-800" />
      </div>
      <Skeleton className="w-full rounded-lg bg-slate-800" style={{ aspectRatio: '16/9' }} />
      <Skeleton className="h-10 w-full rounded-lg bg-slate-800" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 flex flex-col items-center gap-2">
            <Skeleton className="rounded-md bg-slate-800" style={{ width: THUMB_W, height: THUMB_H }} />
            <Skeleton className="w-10 h-3 rounded bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PerformanceTimelineProps {
  timelineData: TimelineData;
}

export function PerformanceTimeline({ timelineData }: PerformanceTimelineProps) {
  const { frames, metrics } = timelineData;
  const maxTiming = frames.at(-1)!.timing;

  const [activeIndex, setActiveIndex] = useState(0);
  const [sliderMs, setSliderMs]       = useState(0);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [playSpeed, setPlaySpeed]     = useState<0.5 | 1>(1);

  const activeThumbRef = useRef<HTMLDivElement>(null);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const playTimeRef    = useRef(0);
  const playSpeedRef   = useRef(playSpeed);

  useEffect(() => { playSpeedRef.current = playSpeed; }, [playSpeed]);

  // Pre-decode all frames so switching is instant
  useEffect(() => {
    for (const f of frames) { const img = new Image(); img.src = f.data; }
  }, [frames]);

  // Auto-scroll filmstrip so active frame stays centered
  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeIndex]);

  // ── Playback ──────────────────────────────────────────────────────────────

  const stopPlayback = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (playTimeRef.current >= maxTiming) { playTimeRef.current = 0; setSliderMs(0); setActiveIndex(0); }

    setIsPlaying(true);
    const TICK = 50;
    intervalRef.current = setInterval(() => {
      playTimeRef.current = Math.min(playTimeRef.current + TICK * playSpeedRef.current, maxTiming);
      const ms = playTimeRef.current;
      setSliderMs(ms);
      setActiveIndex(findClosestFrameIndex(frames, ms));
      if (ms >= maxTiming) { clearInterval(intervalRef.current!); intervalRef.current = null; setIsPlaying(false); }
    }, TICK);
  }, [frames, maxTiming]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const togglePlay = useCallback(() => {
    isPlaying ? stopPlayback() : startPlayback();
  }, [isPlaying, startPlayback, stopPlayback]);

  const handleScrub = useCallback((ms: number) => {
    stopPlayback();
    playTimeRef.current = ms;
    setSliderMs(ms);
    setActiveIndex(findClosestFrameIndex(frames, ms));
  }, [frames, stopPlayback]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeFrame   = frames[activeIndex];
  const progressPct   = maxTiming > 0 ? (sliderMs / maxTiming) * 100 : 0;

  const activeMetrics = METRICS.filter(m => {
    const val = metrics[m.key];
    return val && findClosestFrameIndex(frames, val) === activeIndex;
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900 overflow-hidden select-none">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60">
        <Film className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-semibold text-slate-200 tracking-tight">Performance Timeline</span>

        {/* Current time — prominent */}
        <span className="ml-2 font-mono text-sm font-bold text-white tabular-nums">
          {fmt(sliderMs)}
        </span>
        <span className="text-slate-600 text-xs font-mono">/ {fmt(maxTiming)}</span>

        <div className="ml-auto flex items-center gap-2">
          {/* Metric legend */}
          {METRICS.map(m => {
            const val = metrics[m.key];
            if (!val) return null;
            return (
              <div key={m.key} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800 border border-slate-700/50">
                <span className={`w-2 h-2 rounded-full ${m.bg} flex-shrink-0`} />
                <span className={`text-[11px] font-bold ${m.text}`}>{m.label}</span>
                <span className="text-[11px] text-slate-500 font-mono tabular-nums">{fmt(val)}</span>
              </div>
            );
          })}

          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-semibold transition-colors"
          >
            {isPlaying
              ? <Pause className="w-3.5 h-3.5" />
              : <Play  className="w-3.5 h-3.5" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          {/* Speed */}
          <div className="flex rounded-md overflow-hidden border border-slate-700 text-xs font-mono">
            {([0.5, 1] as const).map(s => (
              <button
                key={s}
                onClick={() => setPlaySpeed(s)}
                className={`px-2.5 py-1.5 transition-colors ${
                  playSpeed === s
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-500 hover:text-slate-300 bg-slate-800'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* ── Main Viewer ──────────────────────────────────────────────────── */}
        <div
          className="relative w-full rounded-lg overflow-hidden bg-slate-950 border border-slate-700/50"
          style={{ aspectRatio: '16/9' }}
        >
          <img
            src={activeFrame.data}
            alt=""
            className="w-full h-full object-contain"
            draggable={false}
          />

          {/* Metric badge(s) on active frame */}
          {activeMetrics.length > 0 && (
            <div className="absolute top-3 left-3 flex gap-1.5">
              {activeMetrics.map(m => (
                <div key={m.key} className={`flex items-center gap-1 px-2 py-1 rounded-md ${m.bg} shadow-lg`}>
                  <span className="text-white text-[11px] font-bold tracking-wide">{m.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Timestamp */}
          <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur-sm border border-slate-700/60 text-slate-100 text-xs font-mono px-2.5 py-1 rounded-md tabular-nums">
            {fmt(activeFrame.timing)}
          </div>
        </div>

        {/* ── Scrubber ─────────────────────────────────────────────────────── */}
        <div className="space-y-1">

          {/* Metric marker labels — above track */}
          <div className="relative h-7">
            {METRICS.map(m => {
              const val = metrics[m.key];
              if (!val) return null;
              const pct = (val / maxTiming) * 100;
              return (
                <div
                  key={m.key}
                  className="absolute bottom-0 flex flex-col items-center gap-0.5 -translate-x-1/2 pointer-events-none"
                  style={{ left: `${pct}%` }}
                >
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${m.bg}/20 border ${m.border}/40`}>
                    <span className={`text-[10px] font-bold ${m.text} leading-none`}>{m.label}</span>
                    <span className={`text-[10px] font-mono ${m.text} leading-none opacity-80`}>{fmt(val)}</span>
                  </div>
                  {/* Connector line */}
                  <div className={`w-px h-1.5 opacity-60`} style={{ background: m.hex }} />
                </div>
              );
            })}
          </div>

          {/* Track */}
          <div className="relative h-5 flex items-center">
            {/* Background track */}
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-slate-700" />

            {/* Progress fill */}
            <div
              className="absolute left-0 h-1.5 rounded-full bg-slate-400 transition-none"
              style={{ width: `${progressPct}%` }}
            />

            {/* Metric tick lines ON the track */}
            {METRICS.map(m => {
              const val = metrics[m.key];
              if (!val) return null;
              const pct = (val / maxTiming) * 100;
              return (
                <div
                  key={m.key}
                  className="absolute w-0.5 h-3 rounded-full -translate-x-1/2 pointer-events-none z-10"
                  style={{ left: `${pct}%`, background: m.hex }}
                />
              );
            })}

            {/* Playhead circle */}
            <div
              className="absolute w-4 h-4 rounded-full bg-white shadow-lg border-2 border-slate-300 -translate-x-1/2 z-20 transition-none"
              style={{ left: `${progressPct}%` }}
            />

            {/* Invisible range input on top for interaction */}
            <input
              type="range"
              min={0}
              max={maxTiming}
              step={1}
              value={sliderMs}
              onChange={e => handleScrub(Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer z-30"
            />
          </div>

          {/* Time axis labels */}
          <div className="flex justify-between text-[10px] font-mono text-slate-500 tabular-nums px-0.5">
            <span>0s</span>
            <span>{fmt(maxTiming)}</span>
          </div>
        </div>

        {/* ── Filmstrip ────────────────────────────────────────────────────── */}
        <div
          className="flex gap-2.5 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}
        >
          {frames.map((frame, i) => {
            const isActive   = i === activeIndex;
            const frameMetrics = METRICS.filter(m => {
              const val = metrics[m.key];
              return val && findClosestFrameIndex(frames, val) === i;
            });

            return (
              <div
                key={i}
                ref={isActive ? activeThumbRef : null}
                onClick={() => handleScrub(frame.timing)}
                className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group"
              >
                {/* Thumbnail */}
                <div
                  className={`relative rounded-md overflow-hidden border-2 transition-all duration-100 ${
                    isActive
                      ? 'border-white shadow-[0_0_0_2px_rgba(255,255,255,0.12),0_0_16px_rgba(255,255,255,0.15)] scale-[1.02]'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                  style={{ width: THUMB_W, height: THUMB_H }}
                >
                  <img
                    src={frame.data}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                  />

                  {/* Metric dots on filmstrip */}
                  {frameMetrics.length > 0 && (
                    <div className="absolute top-1.5 right-1.5 flex gap-1">
                      {frameMetrics.map(m => (
                        <div key={m.key} className={`w-2 h-2 rounded-full ${m.bg} ring-1 ring-black/40`} />
                      ))}
                    </div>
                  )}

                  {/* Active overlay tint */}
                  {isActive && (
                    <div className="absolute inset-0 ring-2 ring-inset ring-white/20 rounded-sm pointer-events-none" />
                  )}
                </div>

                {/* Time label */}
                <span
                  className={`text-xs font-mono tabular-nums transition-colors duration-75 ${
                    isActive ? 'text-white font-semibold' : 'text-slate-500 group-hover:text-slate-400'
                  }`}
                >
                  {(frame.timing / 1000).toFixed(1)}s
                </span>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
