/**
 * TimelineWaterfall — Unified Performance Timeline + Network Waterfall
 *
 * Sticky header contains:
 *   • Play controls + mini video player
 *   • Scrubber with metric markers
 *   • Time-axis thumbnails (one frame per tick)
 *   • Axis ghost line (blue, syncs with scrubber)
 *
 * Body: compact waterfall rows + full-height ghost line
 */
import {
  useRef, useEffect, useMemo, memo, useState, useLayoutEffect, useCallback,
} from 'react';
import {
  FileCode2, Palette, ImageIcon, Type, Globe,
  Network, X, ExternalLink, Play, Pause,
} from 'lucide-react';
import { useMotionValue, useTransform, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTimelineContext } from '../context/TimelineContext';
import { FlameChart } from './FlameChart';
import type {
  ParsedResources, NetworkRequest, ResourceType, TimelineData, TimelineFrame,
  FlameChartData,
} from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const LEFT_W     = 280;
const MAX_ROWS   = 120;
const TICK_COUNT = 6;
const TICK_MS    = 50;
const THUMB_W    = 80;
const THUMB_H    = 45;   // ~16:9

const METRICS_CFG = [
  { key: 'fcp' as const, label: 'FCP', bg: 'bg-blue-500',    text: 'text-blue-400',    hex: '#3b82f6' },
  { key: 'lcp' as const, label: 'LCP', bg: 'bg-emerald-500', text: 'text-emerald-400', hex: '#10b981' },
  { key: 'tti' as const, label: 'TTI', bg: 'bg-orange-500',  text: 'text-orange-400',  hex: '#f97316' },
] as const;

const TYPE_CFG: Record<
  ResourceType,
  { label: string; icon: React.ElementType; barLight: string; barDark: string; badge: string }
> = {
  script:     { label: 'JS',    icon: FileCode2, barLight: 'bg-indigo-400',  barDark: 'bg-indigo-600',  badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'   },
  stylesheet: { label: 'CSS',   icon: Palette,   barLight: 'bg-violet-400',  barDark: 'bg-violet-600',  badge: 'bg-violet-500/20 text-violet-400 border-violet-500/30'   },
  image:      { label: 'IMG',   icon: ImageIcon, barLight: 'bg-emerald-400', barDark: 'bg-emerald-600', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  font:       { label: 'FONT',  icon: Type,      barLight: 'bg-amber-400',   barDark: 'bg-amber-600',   badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30'       },
  document:   { label: 'DOC',   icon: FileCode2, barLight: 'bg-sky-400',     barDark: 'bg-sky-600',     badge: 'bg-sky-500/20 text-sky-400 border-sky-500/30'             },
  media:      { label: 'MEDIA', icon: ImageIcon, barLight: 'bg-pink-400',    barDark: 'bg-pink-600',    badge: 'bg-pink-500/20 text-pink-400 border-pink-500/30'          },
  other:      { label: 'XHR',   icon: Globe,     barLight: 'bg-slate-400',   barDark: 'bg-slate-600',   badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30'       },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b <= 0) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}

function fmtMs(ms: number): string {
  if (ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function resourceFilename(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts.at(-1) || u.hostname;
  } catch {
    return url.split('/').pop() || url;
  }
}

const fmtSec = (ms: number) => (ms / 1000).toFixed(2) + 's';

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

// ─── DetailPanel ──────────────────────────────────────────────────────────────

function DetailPanel({ req, onClose }: { req: NetworkRequest; onClose: () => void }) {
  const cfg      = TYPE_CFG[req.resourceType];
  const duration = req.endTime - req.startTime;
  const name     = resourceFilename(req.url);

  const stats = [
    { label: 'Start',     value: fmtMs(req.startTime),           mono: true },
    { label: 'End',       value: fmtMs(req.endTime),             mono: true },
    { label: 'Duration',  value: fmtMs(duration),                mono: true, bold: true },
    { label: 'TTFB',      value: fmtMs(req.ttfb),                mono: true },
    { label: 'Download',  value: fmtMs(req.contentDownloadTime), mono: true },
    { label: 'Transfer',  value: fmtBytes(req.transferSize),     mono: true, bold: true },
    { label: 'Resource',  value: fmtBytes(req.resourceSize),     mono: true },
    { label: 'MIME',      value: req.mimeType || '—',            mono: true },
    { label: 'Status',    value: req.statusCode ? String(req.statusCode) : '—', mono: true },
    { label: '3rd-party', value: req.isThirdParty ? 'Yes' : 'No' },
  ];

  return (
    <div className="absolute left-2 right-2 z-30 mt-0.5 rounded-lg border border-slate-600 bg-slate-800 shadow-2xl shadow-black/60 text-xs">
      <div className="flex items-start gap-2 px-3 py-2.5 border-b border-slate-700">
        <span className={cn('shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border mt-0.5', cfg.badge)}>
          {cfg.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-100 truncate" title={name}>{name}</p>
          <a href={req.url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-slate-200 truncate mt-0.5 transition-colors"
            title={req.url}>
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{req.url}</span>
          </a>
        </div>
        <button onClick={onClose} className="shrink-0 text-slate-500 hover:text-slate-200 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-3 py-2.5">
        {stats.map(({ label, value, mono, bold }) => (
          <div key={label} className="flex justify-between items-center gap-2">
            <span className="text-slate-500 shrink-0">{label}</span>
            <span className={cn('text-slate-200 tabular-nums', mono && 'font-mono', bold && 'font-semibold text-white')}>
              {value}
            </span>
          </div>
        ))}
      </div>
      {duration > 0 && (
        <div className="px-3 pb-3 space-y-1">
          <div className="flex text-[9px] text-slate-500 justify-between">
            <span>TTFB ({fmtMs(req.ttfb)})</span>
            <span>Download ({fmtMs(req.contentDownloadTime)})</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-slate-700">
            <div className={cn('rounded-l-full', cfg.barLight)} style={{ width: `${Math.min((req.ttfb / duration) * 100, 100)}%` }} />
            <div className={cn('rounded-r-full flex-1', cfg.barDark)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WaterfallRow (compact) ───────────────────────────────────────────────────

interface RowProps {
  req:        NetworkRequest;
  index:      number;
  axisMs:     number;
  isSelected: boolean;
  onSelect:   () => void;
  onDeselect: () => void;
  rowRef:  (el: HTMLDivElement | null) => void;
  ttfbRef: (el: HTMLDivElement | null) => void;
  dlRef:   (el: HTMLDivElement | null) => void;
  shimRef: (el: HTMLDivElement | null) => void;
}

const WaterfallRow = memo(function WaterfallRow({
  req, index, axisMs, isSelected, onSelect, onDeselect,
  rowRef, ttfbRef, dlRef, shimRef,
}: RowProps) {
  const ctx  = useTimelineContext();
  const cfg  = TYPE_CFG[req.resourceType];
  const Icon = cfg.icon;
  const name = resourceFilename(req.url);

  const duration = req.endTime - req.startTime;
  const barLeft  = axisMs > 0 ? (req.startTime / axisMs) * 100 : 0;
  const barWidth = axisMs > 0 ? Math.max((duration / axisMs) * 100, 0.3) : 0;
  const ttfbPct  = duration > 0 ? Math.min((req.ttfb / duration) * 100, 100) : 0;

  return (
    <div className="relative">
      <div
        ref={rowRef}
        data-state="loaded"
        onClick={onSelect}
        onMouseEnter={() => ctx?.hoveredUrl.set(req.url)}
        onMouseLeave={() => ctx?.hoveredUrl.set('')}
        className={cn(
          'flex items-center border-b border-slate-800/60 cursor-pointer select-none',
          'transition-[opacity,filter] duration-200 ease-in-out',
          'data-[state=pending]:opacity-[0.2] data-[state=pending]:grayscale',
          index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/40',
          isSelected && 'ring-1 ring-inset ring-blue-500/40 bg-blue-950/20',
        )}
        style={{ willChange: 'opacity, filter' }}
      >
        {/* Label column */}
        <div
          className="flex items-center gap-2 px-3 py-1 shrink-0 border-r border-slate-800/60"
          style={{ width: LEFT_W }}
        >
          <Icon className="w-3 h-3 shrink-0 text-slate-500" />
          <span className="font-mono text-[11px] text-slate-300 truncate flex-1 leading-none" title={req.url}>
            {name}
          </span>
          <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded border font-mono shrink-0', cfg.badge)}>
            {cfg.label}
          </span>
          <span className="text-[10px] text-slate-500 tabular-nums shrink-0 w-11 text-right font-mono">
            {fmtBytes(req.transferSize)}
          </span>
        </div>

        {/* Bar column */}
        <div className="flex-1 relative h-5 flex items-center">
          <div className="absolute inset-x-0 h-px bg-slate-800/80" />
          {barWidth > 0 && (
            <div
              className="absolute h-2.5 rounded-sm flex overflow-hidden"
              style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
            >
              <div ref={ttfbRef} className={cn('h-full transition-opacity duration-150', cfg.barLight)} style={{ width: `${ttfbPct}%` }} />
              <div ref={dlRef}   className={cn('h-full flex-1 transition-opacity duration-150', cfg.barDark)} />
              <div ref={shimRef} className="wf-shim absolute inset-0 rounded-sm pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {isSelected && <DetailPanel req={req} onClose={onDeselect} />}
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export function TimelineWaterfall({
  resources,
  timelineData,
  flameChartData,
}: {
  resources:       ParsedResources;
  timelineData:    TimelineData;
  flameChartData?: FlameChartData;
}) {
  const ctx = useTimelineContext();
  const { frames, metrics, networkOffsetMs } = timelineData;
  const maxTiming = frames.at(-1)!.timing;

  // ── Waterfall rows
  const rows = useMemo<NetworkRequest[]>(() =>
    resources.requests
      .filter(r => r.endTime > 0 && r.endTime < 600_000)
      .slice()
      .sort((a, b) => a.startTime - b.startTime)
      .slice(0, MAX_ROWS),
  [resources.requests]);

  const wfMs    = useMemo(() => rows.reduce((mx, r) => Math.max(mx, r.endTime), 0), [rows]);
  const axisMs  = maxTiming > 0 ? maxTiming : wfMs;
  const axisMsRef = useRef(axisMs);
  axisMsRef.current = axisMs;

  // ── UI state
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [playSpeed,      setPlaySpeed]      = useState<0.5 | 1>(1);
  const [activeFrameIdx, setActiveFrameIdx] = useState(0);
  const [selectedIdx,    setSelectedIdx]    = useState<number | null>(null);

  const handleSelect   = useCallback((i: number) => setSelectedIdx(p => p === i ? null : i), []);
  const handleDeselect = useCallback(() => setSelectedIdx(null), []);

  // ── MotionValues for scrubber visuals
  const motionMs      = useMotionValue(0);
  const progressWidth = useTransform(motionMs, [0, maxTiming], ['0%', '100%']);
  const playheadLeft  = useTransform(motionMs, [0, maxTiming], ['0%', '100%']);

  // ── DOM refs
  const rootRef      = useRef<HTMLDivElement>(null);
  const rangeRef     = useRef<HTMLInputElement>(null);
  const rowsLineRef  = useRef<HTMLDivElement>(null);
  const axisLineRef  = useRef<HTMLDivElement>(null);
  const curLabelRef  = useRef<HTMLSpanElement>(null);
  const chartWRef    = useRef(0);

  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const playTimeRef   = useRef(0);
  const playSpeedRef  = useRef(playSpeed);
  const prevFrIdxRef  = useRef(0);

  const rowRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const ttfbRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dlRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const shimRefs = useRef<(HTMLDivElement | null)[]>([]);

  rowRefs.current.length  = rows.length;
  ttfbRefs.current.length = rows.length;
  dlRefs.current.length   = rows.length;
  shimRefs.current.length = rows.length;

  useEffect(() => { playSpeedRef.current = playSpeed; }, [playSpeed]);

  useEffect(() => {
    if (ctx) {
      ctx.maxTiming.current     = maxTiming;
      ctx.networkOffset.current = networkOffsetMs;
    }
  }, [ctx, maxTiming, networkOffsetMs]);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const update = () => { chartWRef.current = (rootRef.current?.clientWidth ?? 0) - LEFT_W; };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Scrub
  function handleScrubInternal(ms: number) {
    motionMs.set(ms);
    ctx?.motionMs.set(ms);
    if (rangeRef.current) rangeRef.current.value = String(ms);
    const newIdx = findClosestFrameIndex(frames, ms);
    if (newIdx !== prevFrIdxRef.current) {
      prevFrIdxRef.current = newIdx;
      setActiveFrameIdx(newIdx);
    }
  }

  const stopPlayback = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (playTimeRef.current >= maxTiming) { playTimeRef.current = 0; handleScrubInternal(0); }
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

  const togglePlay = useCallback(() => isPlaying ? stopPlayback() : startPlayback(), [isPlaying, startPlayback, stopPlayback]);
  const handleScrub = useCallback((ms: number) => {
    stopPlayback();
    playTimeRef.current = ms;
    handleScrubInternal(ms);
  }, [stopPlayback]);

  // ── MotionValue subscriber → imperatively update ghost lines + row states
  useEffect(() => {
    const unsub = motionMs.on('change', (sliderMs) => {
      const axMs   = axisMsRef.current;
      const netOff = ctx?.networkOffset.current ?? 0;
      const pct    = Math.min(Math.max(sliderMs / axMs, 0), 1);
      const chartW = chartWRef.current;

      if (rowsLineRef.current) {
        rowsLineRef.current.style.transform = `translateX(${(LEFT_W + chartW * pct).toFixed(1)}px)`;
      }
      if (axisLineRef.current) {
        axisLineRef.current.style.transform = `translateX(${(chartW * pct).toFixed(1)}px)`;
      }
      if (curLabelRef.current) {
        curLabelRef.current.textContent = fmtMs(sliderMs);
      }

      for (let i = 0; i < rows.length; i++) {
        const rowEl = rowRefs.current[i];
        if (!rowEl) continue;
        const { startTime, endTime, ttfb } = rows[i];
        const fStart = startTime + netOff;
        const fEnd   = endTime   + netOff;
        const state  = sliderMs < fStart ? 'pending' : sliderMs >= fEnd ? 'loaded' : 'loading';
        if (rowEl.dataset.state !== state) {
          rowEl.dataset.state = state;
          shimRefs.current[i]?.classList.toggle('wf-shim-active', state === 'loading');
        }
        const ttfbEl = ttfbRefs.current[i];
        const dlEl   = dlRefs.current[i];
        if (state === 'loading') {
          if (ttfbEl) ttfbEl.style.opacity = '1';
          if (dlEl)   dlEl.style.opacity   = sliderMs >= fStart + ttfb ? '1' : '0.3';
        } else {
          if (ttfbEl) ttfbEl.style.opacity = '1';
          if (dlEl)   dlEl.style.opacity   = '1';
        }
      }
    });
    return unsub;
  }, [ctx, rows, motionMs]);

  // preload frames
  useEffect(() => {
    for (const f of frames) { const img = new Image(); img.src = f.data; }
  }, [frames]);

  // axis ticks: one frame per tick
  const axisTicks = useMemo(() =>
    Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
      const ms  = (i / TICK_COUNT) * axisMs;
      const idx = findClosestFrameIndex(frames, ms);
      return { i, ms, frame: frames[idx] };
    }),
  [axisMs, frames]);

  if (rows.length === 0 || wfMs === 0) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-900 px-4 py-8 text-center">
        <Network className="w-5 h-5 text-slate-600 mx-auto mb-2" />
        <p className="text-xs text-slate-500">No network timing data available.</p>
      </div>
    );
  }


  console.log(rows,'rows');
  
  // axis row height: thumbnail + tick mark + label + top padding
  const AXIS_ROW_H = 8 + THUMB_H + 6 + 16 + 8; // 83px

  return (
    <div ref={rootRef} className="rounded-xl border border-slate-700/60">
      <style>{`
        @keyframes wf-shimmer {
          0%   { transform: translateX(-100%); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateX(250%); opacity: 0; }
        }
        .wf-shim-active { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; }
        .wf-shim-active::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%);
          animation: wf-shimmer 1.3s ease-in-out infinite;
        }
      `}</style>

      {/* ══════════ STICKY HEADER ══════════════════════════════════════════ */}
      <div className="sticky top-0 z-50 bg-[#0b1121] rounded-t-xl border-b border-slate-700/60">

        {/* ── Controls row ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2.5">
          <Network className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-sm font-semibold text-slate-200 tracking-tight">Network Waterfall</span>
          <span className="text-[11px] text-slate-500 font-mono tabular-nums">
            {rows.length} req · {fmtMs(wfMs)}
          </span>

          <div className="w-px h-4 bg-slate-700 mx-1 shrink-0" />

          <button
            onClick={togglePlay}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition-colors shrink-0"
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <div className="flex rounded-md overflow-hidden border border-slate-700 text-xs font-mono shrink-0">
            {([0.5, 1] as const).map(s => (
              <button key={s} onClick={() => setPlaySpeed(s)}
                className={`px-2 py-1.5 transition-colors ${playSpeed === s ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300 bg-slate-800'}`}>
                {s}x
              </button>
            ))}
          </div>

          <span ref={curLabelRef}
            className="text-[11px] font-mono font-bold text-blue-300 tabular-nums bg-slate-800 px-2 py-1 rounded border border-blue-500/20 shrink-0">
            0ms
          </span>
          <span className="text-[10px] text-slate-600 font-mono shrink-0">/ {fmtMs(maxTiming)}</span>

          {METRICS_CFG.map(m => {
            const val = metrics[m.key];
            if (!val) return null;
            return (
              <div key={m.key} className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 border border-slate-700/50 shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.bg}`} />
                <span className={`text-[10px] font-bold ${m.text}`}>{m.label}</span>
                <span className={`text-[10px] font-mono ${m.text} opacity-80 tabular-nums`}>{fmtSec(val)}</span>
              </div>
            );
          })}

          {/* Mini video player */}
          <div className="ml-auto relative rounded-lg overflow-hidden border border-slate-600/60 bg-slate-950 shrink-0"
            style={{ width: 120, height: 68 }}>
            <img
              src={frames[activeFrameIdx].data}
              alt=""
              className="w-full h-full object-contain"
              draggable={false}
            />
            <div className="absolute bottom-1 right-1 text-[8px] font-mono text-slate-400 bg-slate-900/80 px-1 rounded tabular-nums">
              {fmtSec(frames[activeFrameIdx].timing)}
            </div>
          </div>
        </div>

        {/* ── Scrubber row — left-aligned with chart area ──────────────── */}
        <div className="pb-2" style={{ paddingLeft: LEFT_W, paddingRight: 16 }}>
          {/* Metric labels above track */}
          <div className="relative h-5 mb-0.5">
            {METRICS_CFG.map(m => {
              const val = metrics[m.key];
              if (!val) return null;
              return (
                <div key={m.key}
                  className="absolute bottom-0 flex flex-col items-center gap-0.5 -translate-x-1/2 pointer-events-none"
                  style={{ left: `${(val / maxTiming) * 100}%` }}>
                  <div className={`flex items-center gap-0.5 px-1 rounded text-[9px] font-bold ${m.text} bg-slate-800 border border-slate-700/60`}>
                    {m.label}
                  </div>
                  <div className="w-px h-1.5" style={{ background: m.hex }} />
                </div>
              );
            })}
          </div>

          {/* Track */}
          <div className="relative h-4 flex items-center">
            <div className="absolute inset-x-0 h-1 rounded-full bg-slate-700" />
            <motion.div className="absolute left-0 h-1 rounded-full bg-slate-400" style={{ width: progressWidth }} />
            {METRICS_CFG.map(m => {
              const val = metrics[m.key];
              if (!val) return null;
              return (
                <div key={m.key}
                  className="absolute w-0.5 h-3 rounded-full -translate-x-1/2 pointer-events-none z-10"
                  style={{ left: `${(val / maxTiming) * 100}%`, background: m.hex }} />
              );
            })}
            <motion.div
              className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-lg border-2 border-slate-300 -translate-x-1/2 z-20"
              style={{ left: playheadLeft }}
            />
            <input
              ref={rangeRef}
              type="range"
              defaultValue={0}
              min={0}
              max={maxTiming}
              step={1}
              onChange={e => handleScrub(Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer z-30"
            />
          </div>
        </div>

        {/* ── Column headers + time axis with thumbnails ────────────────── */}
        <div className="flex border-t border-slate-800/60 text-[10px] font-semibold uppercase tracking-widest text-slate-500">

          {/* Left column label */}
          <div
            className="shrink-0 flex items-center gap-4 px-3 border-r border-slate-800"
            style={{ width: LEFT_W, height: AXIS_ROW_H }}
          >
            <span>Resource</span>
            <span className="ml-auto">Type</span>
            <span className="w-11 text-right">Size</span>
          </div>

          {/* Axis area with thumbnails + ghost line */}
          <div className="flex-1 relative overflow-hidden" style={{ height: AXIS_ROW_H }}>
            {axisTicks.map(({ i, ms, frame }) => (
              <div
                key={i}
                className={cn(
                  'absolute flex flex-col',
                  i === 0
                    ? 'items-start translate-x-0'
                    : i === TICK_COUNT
                    ? 'items-end -translate-x-full'
                    : 'items-center -translate-x-1/2',
                )}
                style={{ left: `${(i / TICK_COUNT) * 100}%`, top: 8 }}
              >
                <img
                  src={frame.data}
                  alt=""
                  className="rounded-sm border border-slate-700/40 object-cover"
                  style={{ width: THUMB_W, height: THUMB_H, opacity: 0.75 }}
                  draggable={false}
                />
                <div className="h-1.5 w-px bg-slate-700 mt-0.5" />
                <span className="text-[9px] font-mono text-slate-500 tabular-nums mt-0.5 normal-case tracking-normal font-normal">
                  {fmtMs(ms)}
                </span>
              </div>
            ))}

            {/* Axis ghost line — positioned within flex-1 */}
            <div
              ref={axisLineRef}
              className="absolute top-0 bottom-0 w-0.5 pointer-events-none z-10"
              style={{
                transform: 'translateX(0)',
                willChange: 'transform',
                background: 'linear-gradient(to bottom, #60a5fa 0%, #60a5fa55 100%)',
              }}
            />
          </div>
        </div>
      </div>

      {/* ══════════ WATERFALL ROWS ═════════════════════════════════════════ */}
      <div className="rounded-b-xl overflow-hidden bg-slate-900">
        <div className="relative">

          {/* Grid lines */}
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: LEFT_W, right: 0 }}>
            {Array.from({ length: TICK_COUNT - 1 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-slate-800/60"
                style={{ left: `${((i + 1) / TICK_COUNT) * 100}%` }}
              />
            ))}
          </div>

          {/* Rows */}
          {rows.map((req, i) => (
            <WaterfallRow
              key={req.url + i}
              req={req}
              index={i}
              axisMs={axisMs}
              isSelected={selectedIdx === i}
              onSelect={() => handleSelect(i)}
              onDeselect={handleDeselect}
              rowRef={el  => { rowRefs.current[i]  = el; }}
              ttfbRef={el => { ttfbRefs.current[i] = el; }}
              dlRef={el   => { dlRefs.current[i]   = el; }}
              shimRef={el => { shimRefs.current[i] = el; }}
            />
          ))}

          {/* Rows ghost line */}
          <div
            ref={rowsLineRef}
            aria-hidden
            className="absolute top-0 bottom-0 w-0.5 pointer-events-none z-20"
            style={{
              transform: `translateX(${LEFT_W}px)`,
              willChange: 'transform',
              background: 'linear-gradient(to bottom, #60a5fa 0%, #60a5fa88 80%, transparent 100%)',
            }}
          >
            <div className="absolute -top-px left-1/2 -translate-x-1/2">
              <div className="w-2 h-2 rounded-full bg-blue-400 ring-2 ring-blue-400/30 shadow-lg shadow-blue-400/40" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between">
          <p className="text-[10px] text-slate-600">
            Scrub timeline or press Play to animate · Click a row for details
          </p>
          {selectedIdx !== null && (
            <button onClick={handleDeselect} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
              Close detail
            </button>
          )}
        </div>

        {/* ── CPU FLAME CHART ────────────────────────────────────────────── */}
        {flameChartData && flameChartData.events.length > 0 && (
          <div className="border-t border-slate-700/60">
            {/* Section header */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/60">
              <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-sm font-semibold text-slate-200 tracking-tight">CPU Main Thread</span>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                {flameChartData.events.length} events ·{' '}
                {flameChartData.events.filter(e => e.isLongTask).length} long tasks ·{' '}
                {flameChartData.maxDepth} call stack levels
              </span>
            </div>
            <FlameChart
              data={flameChartData}
              axisMs={axisMs}
              leftW={LEFT_W}
            />
          </div>
        )}
      </div>
    </div>
  );
}
