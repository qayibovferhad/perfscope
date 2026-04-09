import { useState, useEffect, useRef, useCallback, useMemo, memo, forwardRef } from 'react';
import { Play, Pause, Film } from 'lucide-react';
import { useMotionValue, useTransform, motion, type MotionValue } from 'framer-motion';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { TimelineData, TimelineFrame } from '../types';

// ─── Config ───────────────────────────────────────────────────────────────────

const METRICS = [
  { key: 'fcp' as const, label: 'FCP', bg: 'bg-blue-500',    text: 'text-blue-400',    border: 'border-blue-500',    hex: '#3b82f6' },
  { key: 'lcp' as const, label: 'LCP', bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500', hex: '#10b981' },
  { key: 'tti' as const, label: 'TTI', bg: 'bg-orange-500',  text: 'text-orange-400',  border: 'border-orange-500',  hex: '#f97316' },
];

type MetricEntry = (typeof METRICS)[number];

const THUMB_W = 192;
const THUMB_H = 140;
const TICK_MS = 50;
const EMPTY_DOTS: MetricEntry[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const fmt = (ms: number) => (ms / 1000).toFixed(2) + 's';

// ─── LiveTime — subscribes to a MotionValue, re-renders only itself ───────────

const LiveTime = memo(function LiveTime({
  value,
  className,
}: {
  value: MotionValue<number>;
  className?: string;
}) {
  const [display, setDisplay] = useState(() => fmt(value.get()));
  useEffect(() => value.on('change', v => setDisplay(fmt(v))), [value]);
  return <span className={className}>{display}</span>;
});

// ─── TimelineHeader — memo; only re-renders on isPlaying / playSpeed ──────────

interface HeaderProps {
  isPlaying:    boolean;
  playSpeed:    0.5 | 1;
  metrics:      TimelineData['metrics'];
  maxTiming:    number;
  motionMs:     MotionValue<number>;
  onTogglePlay: () => void;
  onSpeedChange:(s: 0.5 | 1) => void;
}

const TimelineHeader = memo(function TimelineHeader({
  isPlaying, playSpeed, metrics, maxTiming, motionMs, onTogglePlay, onSpeedChange,
}: HeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60">
      <Film className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <span className="text-sm font-semibold text-slate-200 tracking-tight">Performance Timeline</span>

      {/* Current time — updates without re-rendering this component */}
      <LiveTime value={motionMs} className="ml-1 font-mono text-sm font-bold text-white tabular-nums" />
      <span className="text-slate-600 text-xs font-mono">/ {fmt(maxTiming)}</span>

      <div className="ml-auto flex items-center gap-2 flex-wrap">
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
          onClick={onTogglePlay}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-semibold transition-colors"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        {/* Speed */}
        <div className="flex rounded-md overflow-hidden border border-slate-700 text-xs font-mono">
          {([0.5, 1] as const).map(s => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-2.5 py-1.5 transition-colors ${
                playSpeed === s ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300 bg-slate-800'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

// ─── MainViewer — memo; re-renders only when activeIndex changes ───────────────

interface ViewerProps {
  frame:         TimelineFrame;
  activeMetrics: MetricEntry[];
}

const MainViewer = memo(function MainViewer({ frame, activeMetrics }: ViewerProps) {
  return (
    <div
      className="relative w-full rounded-lg overflow-hidden bg-slate-950 border border-slate-700/50"
      style={{ aspectRatio: '16/9' }}
    >
      <img src={frame.data} alt="" className="w-full h-full object-contain" draggable={false} />

      {activeMetrics.length > 0 && (
        <div className="absolute top-3 left-3 flex gap-1.5">
          {activeMetrics.map(m => (
            <div key={m.key} className={`flex items-center gap-1 px-2 py-1 rounded-md ${m.bg} shadow-lg`}>
              <span className="text-white text-[11px] font-bold tracking-wide">{m.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur-sm border border-slate-700/60 text-slate-100 text-xs font-mono px-2.5 py-1 rounded-md tabular-nums">
        {fmt(frame.timing)}
      </div>
    </div>
  );
});

// ─── ScrubberSection — memo; motion.div drives DOM directly, never re-renders ──

interface ScrubberProps {
  maxTiming: number;
  metrics:   TimelineData['metrics'];
  motionMs:  MotionValue<number>;
  rangeRef:  React.RefObject<HTMLInputElement | null>;
  onScrub:   (ms: number) => void;
}

const ScrubberSection = memo(function ScrubberSection({
  maxTiming, metrics, motionMs, rangeRef, onScrub,
}: ScrubberProps) {
  const progressWidth = useTransform(motionMs, [0, maxTiming], ['0%', '100%']);
  const playheadLeft  = useTransform(motionMs, [0, maxTiming], ['0%', '100%']);

  return (
    <div className="space-y-1">
      {/* Metric labels above the track */}
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
              <div className="w-px h-1.5 opacity-50" style={{ background: m.hex }} />
            </div>
          );
        })}
      </div>

      {/* Track */}
      <div className="relative h-5 flex items-center">
        {/* Background */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-slate-700" />

        {/* Progress fill — GPU driven */}
        <motion.div
          className="absolute left-0 h-1.5 rounded-full bg-slate-400"
          style={{ width: progressWidth }}
        />

        {/* Metric tick marks */}
        {METRICS.map(m => {
          const val = metrics[m.key];
          if (!val) return null;
          return (
            <div
              key={m.key}
              className="absolute w-0.5 h-3.5 rounded-full -translate-x-1/2 pointer-events-none z-10"
              style={{ left: `${(val / maxTiming) * 100}%`, background: m.hex }}
            />
          );
        })}

        {/* Playhead — GPU driven */}
        <motion.div
          className="absolute w-4 h-4 rounded-full bg-white shadow-lg border-2 border-slate-300 -translate-x-1/2 z-20"
          style={{ left: playheadLeft }}
        />

        {/* Invisible range input — uncontrolled, value updated via ref */}
        <input
          ref={rangeRef}
          type="range"
          defaultValue={0}
          min={0}
          max={maxTiming}
          step={1}
          onChange={e => onScrub(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer z-30"
        />
      </div>

      {/* Time axis */}
      <div className="flex justify-between text-[10px] font-mono text-slate-500 tabular-nums px-0.5">
        <span>0s</span>
        <span>{fmt(maxTiming)}</span>
      </div>
    </div>
  );
});

// ─── FilmstripItem — memo + forwardRef; re-renders only when isActive flips ───

interface FilmstripItemProps {
  frame:      TimelineFrame;
  isActive:   boolean;
  metricDots: MetricEntry[];
  onClick:    () => void;
}

const FilmstripItem = memo(
  forwardRef<HTMLDivElement, FilmstripItemProps>(function FilmstripItem(
    { frame, isActive, metricDots, onClick },
    ref,
  ) {
    return (
      <div ref={ref} onClick={onClick} className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group">
        <div
          className={`relative rounded-md overflow-hidden border-2 transition-all duration-100 ${
            isActive
              ? 'border-white shadow-[0_0_0_2px_rgba(255,255,255,0.12),0_0_16px_rgba(255,255,255,0.15)] scale-[1.02]'
              : 'border-slate-700 hover:border-slate-500'
          }`}
          style={{ width: THUMB_W, height: THUMB_H }}
        >
          <img src={frame.data} alt="" className="w-full h-full object-cover" draggable={false} />

          {metricDots.length > 0 && (
            <div className="absolute top-1.5 right-1.5 flex gap-1">
              {metricDots.map(m => (
                <div key={m.key} className={`w-2.5 h-2.5 rounded-full ${m.bg} ring-1 ring-black/40`} />
              ))}
            </div>
          )}
        </div>

        <span className={`text-xs font-mono tabular-nums transition-colors duration-75 ${
          isActive ? 'text-white font-semibold' : 'text-slate-500 group-hover:text-slate-400'
        }`}>
          {(frame.timing / 1000).toFixed(1)}s
        </span>
      </div>
    );
  }),
);

// ─── Skeleton ────────────────────────────────────────────────────────────────

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

// ─── Root Component ───────────────────────────────────────────────────────────

export function PerformanceTimeline({ timelineData }: { timelineData: TimelineData }) {
  const { frames, metrics } = timelineData;
  const maxTiming = frames.at(-1)!.timing;

  // ── State (minimal — drives only structural changes) ─────────────────────
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [playSpeed,   setPlaySpeed]   = useState<0.5 | 1>(1);

  // ── MotionValue — drives scrubber DOM directly, zero React renders ────────
  const motionMs = useMotionValue(0);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const rangeRef     = useRef<HTMLInputElement>(null);
  const thumbRefs    = useRef<(HTMLDivElement | null)[]>([]);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const playTimeRef  = useRef(0);
  const playSpeedRef = useRef(playSpeed);
  const prevIdxRef   = useRef(0);

  useEffect(() => { playSpeedRef.current = playSpeed; }, [playSpeed]);

  const frameMetricDots = useMemo<MetricEntry[][]>(() => {
    const map = new Map<number, MetricEntry[]>();
    for (const m of METRICS) {
      const val = metrics[m.key];
      if (!val) continue;
      const idx = findClosestFrameIndex(frames, val);
      if (!map.has(idx)) map.set(idx, []);
      map.get(idx)!.push(m);
    }
    return frames.map((_, i) => map.get(i) ?? EMPTY_DOTS);
  }, [frames, metrics]);

  const frameClickHandlers = useMemo(
    () => frames.map(f => () => handleScrubInternal(f.timing)),
    [frames],
  );

  useEffect(() => {
    for (const f of frames) { const img = new Image(); img.src = f.data; }
  }, [frames]);

  useEffect(() => {
    thumbRefs.current[activeIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeIndex]);

  function handleScrubInternal(ms: number) {
    motionMs.set(ms);
    if (rangeRef.current) rangeRef.current.value = String(ms);

    const newIdx = findClosestFrameIndex(frames, ms);
    if (newIdx !== prevIdxRef.current) {
      prevIdxRef.current = newIdx;
      setActiveIndex(newIdx);
    }
  }

  const stopPlayback = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (playTimeRef.current >= maxTiming) {
      playTimeRef.current = 0;
      handleScrubInternal(0);
    }
    setIsPlaying(true);

    intervalRef.current = setInterval(() => {
      playTimeRef.current = Math.min(playTimeRef.current + TICK_MS * playSpeedRef.current, maxTiming);
      handleScrubInternal(playTimeRef.current);
      if (playTimeRef.current >= maxTiming) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setIsPlaying(false);
      }
    }, TICK_MS);
  }, [maxTiming]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const togglePlay = useCallback(() => {
    isPlaying ? stopPlayback() : startPlayback();
  }, [isPlaying, startPlayback, stopPlayback]);

  const handleScrub = useCallback((ms: number) => {
    stopPlayback();
    playTimeRef.current = ms;
    handleScrubInternal(ms);
  }, [stopPlayback]);

  const activeFrame   = frames[activeIndex];
  const activeMetrics = frameMetricDots[activeIndex];


  console.log('render');
  
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900 overflow-hidden select-none">
      <TimelineHeader
        isPlaying={isPlaying}
        playSpeed={playSpeed}
        metrics={metrics}
        maxTiming={maxTiming}
        motionMs={motionMs}
        onTogglePlay={togglePlay}
        onSpeedChange={setPlaySpeed}
      />

      <div className="p-4 space-y-4">
        <MainViewer frame={activeFrame} activeMetrics={activeMetrics} />

        <ScrubberSection
          maxTiming={maxTiming}
          metrics={metrics}
          motionMs={motionMs}
          rangeRef={rangeRef}
          onScrub={handleScrub}
        />

        {/* Filmstrip */}
        <div
          className="flex gap-2.5 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}
        >
          {frames.map((frame, i) => (
            <FilmstripItem
              key={i}
              ref={el => { thumbRefs.current[i] = el; }}
              frame={frame}
              isActive={i === activeIndex}
              metricDots={frameMetricDots[i]}
              onClick={frameClickHandlers[i]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
