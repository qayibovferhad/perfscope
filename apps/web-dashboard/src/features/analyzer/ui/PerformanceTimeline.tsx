import { useState, useEffect, useRef, useCallback, useMemo, memo, forwardRef } from 'react';
import { Play, Pause, Film } from 'lucide-react';
import { useMotionValue, useTransform, motion, type MotionValue } from 'framer-motion';
import { useTimelineContext } from '../model/TimelineContext';
import { METRIC_MARKERS, findClosestFrameIndex, type TimelineData, type TimelineFrame } from '@/entities/analysis';
import { fmtSec, fmtSec2 } from '@/shared/lib/format';
import { useTimelinePlayback, type PlaySpeed } from '@/shared/lib/useTimelinePlayback';
import { Button } from '@/shared/ui/button';
import { Segmented, type SegmentOption } from '@/shared/ui/segmented';

const SPEED_OPTIONS: SegmentOption<string>[] = [
  { value: '0.5', label: '0.5x' },
  { value: '1',   label: '1x'   },
];

// The shared marker table, not a local palette: this component held the exact copy
// METRIC_MARKERS' docstring describes as the bug — FCP was blue here and teal on the
// waterfall rendered by the same results panel.
type MetricEntry = (typeof METRIC_MARKERS)[number];

const THUMB_W = 148;
const THUMB_H = 108;
const EMPTY_DOTS: MetricEntry[] = [];

const LiveTime = memo(function LiveTime({ value, className }: { value: MotionValue<number>; className?: string }) {
  const [display, setDisplay] = useState(() => fmtSec2(value.get()));
  useEffect(() => value.on('change', v => setDisplay(fmtSec2(v))), [value]);
  return <span className={className}>{display}</span>;
});

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
    <div className="flex items-center gap-3 px-4 py-3 border-b border-ld-border">
      <Film className="w-4 h-4 text-ld-text-3 flex-shrink-0" />
      <span className="text-sm font-semibold text-ld-text tracking-tight">Performance Timeline</span>
      <LiveTime value={motionMs} className="ml-1 font-mono text-sm font-bold text-ld-text tabular-nums" />
      <span className="text-ld-text-3 text-xs font-mono">/ {fmtSec2(maxTiming)}</span>
      <div className="ml-auto flex items-center gap-2 flex-wrap">
        {METRIC_MARKERS.map(m => {
          const val = metrics[m.key];
          if (!val) return null;
          return (
            <div key={m.key} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-ld-surface-2 border border-ld-border">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
              <span className="text-[11px] font-bold" style={{ color: m.color }}>{m.label}</span>
              <span className="text-[11px] text-ld-text-3 font-mono tabular-nums">{fmtSec2(val)}</span>
            </div>
          );
        })}
        <Button variant="outline" size="sm" onClick={onTogglePlay}>
          {isPlaying ? <Pause /> : <Play />}
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        <Segmented
          ariaLabel="Playback speed"
          size="sm"
          className="font-mono"
          value={String(playSpeed)}
          onChange={v => onSpeedChange(Number(v) as PlaySpeed)}
          options={SPEED_OPTIONS}
        />
      </div>
    </div>
  );
});

const MainViewer = memo(function MainViewer({ frame, activeMetrics }: { frame: TimelineFrame; activeMetrics: MetricEntry[] }) {
  return (
    <div className="relative w-full rounded-lg overflow-hidden bg-ld-bg-2 border border-ld-border aspect-video">
      <img src={frame.data} alt="" className="w-full h-full object-contain" draggable={false} />
      {activeMetrics.length > 0 && (
        <div className="absolute top-3 left-3 flex gap-1.5">
          {activeMetrics.map(m => (
            <div key={m.key} className="flex items-center gap-1 px-2 py-1 rounded-md shadow-lg" style={{ background: m.color }}>
              <span className="text-white text-[11px] font-bold tracking-wide">{m.label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="absolute bottom-3 right-3 bg-ld-surface/90 backdrop-blur-sm border border-ld-border text-ld-text text-xs font-mono px-2.5 py-1 rounded-md tabular-nums">
        {fmtSec2(frame.timing)}
      </div>
    </div>
  );
});

interface ScrubberProps {
  maxTiming: number;
  metrics:   TimelineData['metrics'];
  motionMs:  MotionValue<number>;
  rangeRef:  React.RefObject<HTMLInputElement | null>;
  onScrub:   (ms: number) => void;
}

const ScrubberSection = memo(function ScrubberSection({ maxTiming, metrics, motionMs, rangeRef, onScrub }: ScrubberProps) {
  const progressWidth = useTransform(motionMs, [0, maxTiming], ['0%', '100%']);
  const playheadLeft  = useTransform(motionMs, [0, maxTiming], ['0%', '100%']);

  return (
    <div className="space-y-1">
      <div className="relative h-7">
        {METRIC_MARKERS.map(m => {
          const val = metrics[m.key];
          if (!val) return null;
          const pct = (val / maxTiming) * 100;
          return (
            <div
              key={m.key}
              className="absolute bottom-0 flex flex-col items-center gap-0.5 -translate-x-1/2 pointer-events-none"
              style={{ left: `${pct}%` }}
            >
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded"
                style={{ background: m.soft, border: `1px solid ${m.line}` }}
              >
                <span className="text-[10px] font-bold leading-none" style={{ color: m.color }}>{m.label}</span>
                <span className="text-[10px] font-mono leading-none opacity-80" style={{ color: m.color }}>{fmtSec2(val)}</span>
              </div>
              <div className="w-px h-1.5 opacity-50" style={{ background: m.color }} />
            </div>
          );
        })}
      </div>

      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-ld-border" />
        <motion.div className="absolute left-0 h-1.5 rounded-full bg-ld-text-3" style={{ width: progressWidth }} />
        {METRIC_MARKERS.map(m => {
          const val = metrics[m.key];
          if (!val) return null;
          return (
            <div
              key={m.key}
              className="absolute w-0.5 h-3.5 rounded-full -translate-x-1/2 pointer-events-none z-10"
              style={{ left: `${(val / maxTiming) * 100}%`, background: m.color }}
            />
          );
        })}
        <motion.div
          className="absolute w-4 h-4 rounded-full bg-ld-surface shadow-lg border-2 border-ld-accent -translate-x-1/2 z-20"
          style={{ left: playheadLeft }}
        />
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

      <div className="flex justify-between text-[10px] font-mono text-ld-text-3 tabular-nums px-0.5">
        <span>0s</span>
        <span>{fmtSec2(maxTiming)}</span>
      </div>
    </div>
  );
});

interface FilmstripItemProps {
  frame:      TimelineFrame;
  isActive:   boolean;
  metricDots: MetricEntry[];
  onClick:    () => void;
}

const FilmstripItem = memo(
  forwardRef<HTMLDivElement, FilmstripItemProps>(function FilmstripItem({ frame, isActive, metricDots, onClick }, ref) {
    return (
      <div ref={ref} onClick={onClick} className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group">
        <div
          className={`relative rounded-md overflow-hidden border-2 transition-all duration-100 ${
            isActive
              ? 'border-white shadow-[0_0_0_2px_rgba(255,255,255,0.12),0_0_16px_rgba(255,255,255,0.15)] scale-[1.02]'
              : 'border-ld-border hover:border-ld-border-strong'
          }`}
          style={{ width: THUMB_W, height: THUMB_H }}
        >
          <img src={frame.data} alt="" className="w-full h-full object-cover" draggable={false} />
          {metricDots.length > 0 && (
            <div className="absolute top-1.5 right-1.5 flex gap-1">
              {metricDots.map(m => (
                <div key={m.key} className="w-2.5 h-2.5 rounded-full ring-1 ring-black/40" style={{ background: m.color }} />
              ))}
            </div>
          )}
        </div>
        <span className={`text-xs font-mono tabular-nums transition-colors duration-75 ${
          isActive ? 'text-ld-text font-semibold' : 'text-ld-text-3 group-hover:text-ld-text-2'
        }`}>
          {fmtSec(frame.timing)}
        </span>
      </div>
    );
  }),
);

export function PerformanceTimeline({ timelineData }: { timelineData: TimelineData }) {
  const { frames, metrics, networkOffsetMs } = timelineData;
  const maxTiming = frames.at(-1)!.timing;

  const [activeIndex, setActiveIndex] = useState(0);

  const timelineCtx = useTimelineContext();

  useEffect(() => {
    if (timelineCtx) {
      timelineCtx.maxTiming.current     = maxTiming;
      timelineCtx.networkOffset.current = networkOffsetMs;
    }
  }, [timelineCtx, maxTiming, networkOffsetMs]);

  const motionMs = useMotionValue(0);

  const rangeRef   = useRef<HTMLInputElement>(null);
  const thumbRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const prevIdxRef = useRef(0);

  const frameMetricDots = useMemo<MetricEntry[][]>(() => {
    const map = new Map<number, MetricEntry[]>();
    for (const m of METRIC_MARKERS) {
      const val = metrics[m.key];
      if (!val) continue;
      const idx = findClosestFrameIndex(frames, val);
      if (!map.has(idx)) map.set(idx, []);
      map.get(idx)!.push(m);
    }
    return frames.map((_, i) => map.get(i) ?? EMPTY_DOTS);
  }, [frames, metrics]);

  const handleScrubInternal = useCallback((ms: number) => {
    motionMs.set(ms);
    timelineCtx?.motionMs.set(ms);
    if (rangeRef.current) rangeRef.current.value = String(ms);
    const newIdx = findClosestFrameIndex(frames, ms);
    if (newIdx !== prevIdxRef.current) {
      prevIdxRef.current = newIdx;
      setActiveIndex(newIdx);
    }
  }, [frames, motionMs, timelineCtx]);

  const frameClickHandlers = useMemo(
    () => frames.map(f => () => handleScrubInternal(f.timing)),
    [frames, handleScrubInternal],
  );

  useEffect(() => {
    for (const f of frames) { const img = new Image(); img.src = f.data; }
  }, [frames]);

  useEffect(() => {
    thumbRefs.current[activeIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeIndex]);

  const {
    isPlaying, speed: playSpeed, setSpeed: setPlaySpeed,
    toggle: togglePlay, seek: handleScrub,
  } = useTimelinePlayback({ totalMs: maxTiming, onTick: handleScrubInternal });

  return (
    <div className="rounded-xl border border-ld-border bg-ld-surface overflow-hidden select-none">
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
        <MainViewer frame={frames[activeIndex]} activeMetrics={frameMetricDots[activeIndex]} />
        <ScrubberSection
          maxTiming={maxTiming}
          metrics={metrics}
          motionMs={motionMs}
          rangeRef={rangeRef}
          onScrub={handleScrub}
        />
        <div className="flex gap-2.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--ld-border-strong) transparent' }}>
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
