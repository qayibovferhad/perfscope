import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { CompareSection } from './CompareSection';
import { SIDE_TEXT, SIDE_DOT, SIDE_VAR, sideOf } from './sides';
import { Film } from 'lucide-react';
import { findFrameAt, METRIC_MARKERS } from '@/entities/analysis';
import type { AnalysisResult, TimelineData, TimelineFrame } from '@/entities/analysis';
import { fmtSec2 } from '@/shared/lib/format';
import { TransportBar } from './TransportBar';

// ─── Metric defs (timeline marker colors — not you/rival) ─────────────────────
// Shared with the analyzer's waterfall, which marks the same three vitals: they used to
// disagree, and this copy was hardcoded hex that ignored the theme entirely.

const METRIC_DEFS = METRIC_MARKERS;

const NEAR_MS = 400;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function metricBadgesForFrame(
  frame: TimelineFrame,
  frames: TimelineFrame[],
  metrics: TimelineData['metrics'],
): typeof METRIC_DEFS {
  return METRIC_DEFS.filter(m => {
    const val = metrics[m.key];
    return val && findFrameAt(frames, val) === frame;
  });
}

// ─── FrameImage ───────────────────────────────────────────────────────────────

type ImgStatus = 'loading' | 'ready' | 'error';

const FrameImage = memo(function FrameImage({
  src, alt, width, height, dimmed = false, eager = false,
}: {
  src: string; alt: string; width: number; height: number;
  dimmed?: boolean; eager?: boolean;
}) {
  const [status, setStatus] = useState<ImgStatus>(() => src ? 'loading' : 'error');
  useEffect(() => { setStatus(src ? 'loading' : 'error'); }, [src]);

  return (
    <div style={{ width, height }} className="relative overflow-hidden shrink-0">
      {status === 'loading' && (
        <div className="absolute inset-0 animate-pulse bg-ld-border" />
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-ld-surface-2">
          <Film className="w-4 h-4 text-ld-text-3 opacity-50" />
          <span className="text-[7px] text-ld-text-3">N/A</span>
        </div>
      )}
      {src && (
        <img
          src={src} alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          draggable={false}
          onLoad={()  => setStatus('ready')}
          onError={() => setStatus('error')}
          style={{
            width, height,
            objectFit: 'cover',
            display:   status === 'ready' ? 'block' : 'none',
            opacity:   dimmed ? 0.5 : 1,
          }}
        />
      )}
    </div>
  );
});

// ─── Thumbnail ────────────────────────────────────────────────────────────────

const Thumb = memo(function Thumb({
  frame, frames, metrics, isActive, totalMs, isYou, overrideColor, onClick,
}: {
  frame: TimelineFrame; frames: TimelineFrame[];
  metrics: TimelineData['metrics'];
  isActive: boolean; totalMs: number;
  isYou: boolean; overrideColor?: string;
  onClick: () => void;
}) {
  const loadPct = totalMs > 0 ? Math.round((frame.timing / totalMs) * 100) : 0;
  const badges  = useMemo(() => metricBadgesForFrame(frame, frames, metrics), [frame, frames, metrics]);

  // Active border: metric-override color takes precedence; then side CSS var
  const activeBorderStyle = overrideColor
    ? { border: `2px solid ${overrideColor}`, boxShadow: `0 0 12px ${overrideColor}50` }
    : undefined;

  const activeBorderClass = !overrideColor && isActive
    ? isYou
      ? 'border-ld-accent shadow-[0_0_12px_var(--ld-accent-soft)]'
      : 'border-ld-amber-line shadow-[0_0_12px_var(--ld-amber-soft)]'
    : 'border-ld-border';

  return (
    <button onClick={onClick} className="flex flex-col gap-1 shrink-0 w-20">
      <div
        className={`relative overflow-hidden rounded-md transition-all duration-150 border-2 ${activeBorderClass}`}
        style={isActive ? activeBorderStyle : undefined}
      >
        <FrameImage
          key={frame.timing}
          src={frame.data}
          alt={fmtSec2(frame.timing)}
          width={76} height={56}
          dimmed={!isActive}
        />

        {/* Metric badges */}
        {badges.length > 0 && (
          <div className="absolute top-1 right-1 flex flex-col gap-0.5 z-20">
            {badges.map(m => (
              <span
                key={m.key}
                className="text-[7px] font-black px-1 py-0 rounded leading-tight text-white"
                style={{ background: m.color, boxShadow: `0 0 6px ${m.glow}` }}
              >
                {m.label}
              </span>
            ))}
          </div>
        )}

        {/* Timing label */}
        <div className="absolute bottom-0 inset-x-0 text-center text-[8px] font-bold tabular-nums py-0.5 z-10 bg-black/70">
          <span style={{ color: isActive ? SIDE_VAR[sideOf(isYou)] : 'var(--ld-text-3)' }}>
            {fmtSec2(frame.timing)}
          </span>
        </div>
      </div>

      {/* Load progress bar */}
      <div className="w-full h-[3px] rounded-full overflow-hidden bg-ld-border">
        <div
          className={`h-full rounded-full transition-all duration-300
            ${isActive
              ? isYou
                ? 'bg-gradient-to-r from-ld-accent-soft to-ld-accent'
                : 'bg-gradient-to-r from-[var(--ld-amber-soft)] to-ld-amber'
              : 'bg-ld-border-strong'}`}
          style={{ width: `${loadPct}%` }}
        />
      </div>
      <span className="text-[8px] text-center text-ld-text-3">{loadPct}%</span>
    </button>
  );
});

// ─── Filmstrip row ────────────────────────────────────────────────────────────

function FilmstripRow({
  label, isYou, data, currentMs, totalMs, onSeek, nearbyMetricColor,
}: {
  label: string; isYou: boolean;
  data: TimelineData; currentMs: number; totalMs: number;
  onSeek: (ms: number) => void;
  nearbyMetricColor?: string;
}) {
  const active = findFrameAt(data.frames, currentMs);

  // Active frame border: nearby metric color OR side CSS var
  const activeFrameStyle = nearbyMetricColor
    ? { border: `2px solid ${nearbyMetricColor}`, boxShadow: `0 0 20px ${nearbyMetricColor}90, 0 0 40px ${nearbyMetricColor}40` }
    : undefined;

  const activeFrameClass = !nearbyMetricColor
    ? isYou
      ? 'border-ld-accent shadow-[0_0_20px_var(--ld-accent-soft)]'
      : 'border-ld-amber-line shadow-[0_0_20px_var(--ld-amber-soft)]'
    : '';

  return (
    <div className="flex flex-col gap-3">
      {/* Label + metric seek pills */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-[7px]">
          <span className={`w-2 h-2 rounded-full shrink-0 ${SIDE_DOT[sideOf(isYou)]}`} />
          <span className={`text-[11px] font-bold uppercase tracking-[.08em] ${SIDE_TEXT[sideOf(isYou)]}`}>
            {label}
          </span>
        </div>
        {METRIC_DEFS.map(m => {
          const val = data.metrics[m.key];
          if (!val) return null;
          return (
            <button
              key={m.key}
              onClick={() => onSeek(val)}
              className="flex items-center gap-1 px-[7px] py-[3px] rounded-[6px] text-[9px] font-bold hover:opacity-80 transition-opacity"
              style={{ background: m.soft, border: `1px solid ${m.line}`, color: m.color }}
              title={`Seek to ${m.label}: ${fmtSec2(val)}`}
            >
              <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: m.color }} />
              {m.label} {fmtSec2(val)}
            </button>
          );
        })}
      </div>

      {/* Scrollable strip + active frame */}
      <div className="flex gap-3 items-start">
        <div
          className="flex gap-1.5 overflow-x-auto pb-1 flex-1"
          style={{ scrollbarWidth: 'none' } as React.CSSProperties}
        >
          {data.frames.map((frame, i) => (
            <Thumb
              key={i}
              frame={frame} frames={data.frames} metrics={data.metrics}
              isActive={frame === active}
              totalMs={totalMs}
              isYou={isYou}
              overrideColor={frame === active ? nearbyMetricColor : undefined}
              onClick={() => onSeek(frame.timing)}
            />
          ))}
        </div>

        {/* Active frame — large preview */}
        <div
          className={`shrink-0 rounded-[10px] overflow-hidden transition-all duration-200 border-2 ${activeFrameClass}`}
          style={{ width: 148, ...(activeFrameStyle ?? {}) }}
        >
          <FrameImage
            key={active.timing}
            src={active.data}
            alt="Active frame"
            width={144} height={108}
            eager
          />
          <div className="text-center text-[10px] font-bold tabular-nums py-1 bg-black/80">
            <span style={{ color: nearbyMetricColor ?? SIDE_VAR[sideOf(isYou)] }}>
              {fmtSec2(active.timing)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Track marker ─────────────────────────────────────────────────────────────

function TrackMarker({
  metricLabel, sideLabel, color, glow, timeMs, left, direction, onClick,
}: {
  metricLabel: string; sideLabel: string; color: string; glow: string;
  timeMs: number; left: string; direction: 'up' | 'down'; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const triangle: React.CSSProperties = direction === 'up'
    ? { borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: `8px solid ${color}`, width: 0, height: 0 }
    : { borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `8px solid ${color}`,    width: 0, height: 0 };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute -translate-x-1/2 flex flex-col items-center"
      style={{ left, [direction === 'up' ? 'bottom' : 'top']: 0, zIndex: hovered ? 30 : 10 }}
    >
      {direction === 'up' && (
        <span className="text-[8px] font-bold mb-0.5 whitespace-nowrap transition-all duration-100"
          style={{ color, opacity: hovered ? 1 : 0.75, textShadow: hovered ? `0 0 8px ${glow}` : 'none' }}>
          {metricLabel}
        </span>
      )}
      <div style={{ ...triangle, filter: hovered ? `drop-shadow(0 0 4px ${glow})` : 'none', transition: 'filter 0.15s' }} />
      {direction === 'down' && (
        <span className="text-[8px] font-bold mt-0.5 whitespace-nowrap transition-all duration-100"
          style={{ color, opacity: hovered ? 1 : 0.65, textShadow: hovered ? `0 0 8px ${glow}` : 'none' }}>
          {metricLabel}
        </span>
      )}
      {hovered && (
        <div
          className="absolute whitespace-nowrap px-[10px] py-[6px] rounded-[10px] text-[10px] font-semibold pointer-events-none z-50 bg-ld-surface text-ld-text shadow-ld-shadow-card"
          style={{
            [direction === 'up' ? 'bottom' : 'top']: '100%',
            left: '50%', transform: 'translateX(-50%)',
            [direction === 'down' ? 'marginTop' : 'marginBottom']: 6,
            border: `1px solid ${color}45`,
          }}
        >
          <span style={{ color }}>{sideLabel}</span>
          <span className="text-ld-text-3 mx-1">·</span>
          <span>{metricLabel}: {fmtSec2(timeMs)}</span>
        </div>
      )}
    </button>
  );
}

// ─── Shared timeline axis ─────────────────────────────────────────────────────

function TimeAxis({
  tData, cData, currentMs, totalMs, isPlaying, onSeek, onTogglePlay,
}: {
  tData?: TimelineData | null; cData?: TimelineData | null;
  currentMs: number; totalMs: number;
  isPlaying: boolean; onSeek: (ms: number) => void; onTogglePlay: () => void;
}) {
  const pct = (ms: number) => `${((ms / totalMs) * 100).toFixed(2)}%`;

  return (
    <div className="border-t border-b border-ld-border py-3 space-y-0">

      {/* Your Site track — markers point UP */}
      <div
        className="relative rounded-t-[8px] overflow-visible border-b border-ld-accent-line"
        style={{ height: 44, background: 'var(--ld-accent-soft)' }}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1 pl-2">
          <span className="w-[6px] h-[6px] rounded-full bg-ld-accent" />
          <span className="text-[8px] font-bold uppercase tracking-[.12em] text-ld-accent-2 opacity-70">Your Site</span>
        </div>
        {tData && METRIC_DEFS.map(m => {
          const val = tData.metrics[m.key];
          if (!val || val > totalMs) return null;
          return (
            <TrackMarker key={m.key} metricLabel={m.label} sideLabel="Your Site"
              color={m.color} glow={m.glow} timeMs={val} left={pct(val)} direction="up" onClick={() => onSeek(val)} />
          );
        })}
      </div>

      {/* Scrubber */}
      <TransportBar
        isPlaying={isPlaying}
        onTogglePlay={onTogglePlay}
        currentMs={currentMs}
        totalMs={totalMs}
        onSeek={onSeek}
        format={fmtSec2}
        className="py-[10px] px-1"
      />

      {/* Competitor track — markers point DOWN */}
      <div
        className="relative rounded-b-[8px] overflow-visible border-t border-ld-amber-line"
        style={{ height: 44, background: 'var(--ld-amber-wash)' }}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1 pl-2">
          <span className="w-[6px] h-[6px] rounded-full bg-ld-amber" />
          <span className="text-[8px] font-bold uppercase tracking-[.12em] text-ld-amber opacity-70">Competitor</span>
        </div>
        {cData && METRIC_DEFS.map(m => {
          const val = cData.metrics[m.key];
          if (!val || val > totalMs) return null;
          return (
            <TrackMarker key={m.key} metricLabel={m.label} sideLabel="Competitor"
              color={m.color} glow={m.glow} timeMs={val} left={pct(val)} direction="down" onClick={() => onSeek(val)} />
          );
        })}
      </div>

      {/* Tick labels */}
      <div className="flex justify-between pt-[6px]">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="text-[8px] tabular-nums text-ld-text-3 opacity-60">
            {fmtSec2((i / 4) * totalMs)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function FilmstripComparison({
  target, competitor,
}: {
  target: AnalysisResult; competitor: AnalysisResult;
}) {
  const tData = target.timelineData;
  const cData = competitor.timelineData;

  const totalMs = Math.max(
    tData?.frames.at(-1)?.timing ?? 0,
    cData?.frames.at(-1)?.timing ?? 0,
  );

  const [currentMs, setCurrentMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const nearbyMetricColor = useMemo(() => {
    for (const m of METRIC_DEFS) {
      const tVal = tData?.metrics[m.key];
      const cVal = cData?.metrics[m.key];
      if ((tVal && Math.abs(currentMs - tVal) < NEAR_MS) ||
          (cVal && Math.abs(currentMs - cVal) < NEAR_MS)) {
        return m.color;
      }
    }
    return undefined;
  }, [currentMs, tData, cData]);

  const rafRef     = useRef<number | null>(null);
  const startRef   = useRef<number>(0);
  const startMsRef = useRef<number>(0);

  const stopPlay = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setIsPlaying(false);
  }, []);

  const startPlay = useCallback((fromMs: number) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    startRef.current   = performance.now();
    startMsRef.current = fromMs;
    setIsPlaying(true);
    function tick(now: number) {
      const ms = startMsRef.current + (now - startRef.current);
      if (ms >= totalMs) { setCurrentMs(totalMs); setIsPlaying(false); return; }
      setCurrentMs(ms);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [totalMs]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const seek = useCallback((ms: number) => {
    stopPlay();
    setCurrentMs(Math.max(0, Math.min(ms, totalMs)));
  }, [totalMs, stopPlay]);

  const togglePlay = useCallback(() => {
    if (isPlaying) { stopPlay(); return; }
    const from = currentMs >= totalMs ? 0 : currentMs;
    if (from === 0) setCurrentMs(0);
    startPlay(from);
  }, [isPlaying, currentMs, totalMs, stopPlay, startPlay]);

  // After the hooks — an early return above them breaks hook order once a side loads.
  if (!tData && !cData) return null;

  return (
    <CompareSection
      icon={<Film />}
      title="Filmstrip Comparison"
      badge="Synchronized Playback"
      right={
        <div className="flex items-center gap-4">
          {METRIC_DEFS.map(m => (
            <span key={m.key} className="flex items-center gap-1 text-[10px] text-ld-text-3">
              <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: m.color }} />
              {m.label}
            </span>
          ))}
        </div>
      }
    >
      {/* Content */}
      <div className="space-y-5">
        {tData && (
          <FilmstripRow
            label="Your Site" isYou={true}
            data={tData} currentMs={currentMs} totalMs={totalMs}
            onSeek={seek} nearbyMetricColor={nearbyMetricColor}
          />
        )}

        <TimeAxis
          tData={tData} cData={cData}
          currentMs={currentMs} totalMs={totalMs}
          isPlaying={isPlaying} onSeek={seek} onTogglePlay={togglePlay}
        />

        {cData && (
          <FilmstripRow
            label="Competitor" isYou={false}
            data={cData} currentMs={currentMs} totalMs={totalMs}
            onSeek={seek} nearbyMetricColor={nearbyMetricColor}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-6 mt-5 pt-4 border-t border-ld-border flex-wrap text-[9px] text-ld-text-3">
        <span>● Your Site markers</span>
        <span>◎ Competitor markers</span>
        <span>Colored badges on frames indicate FCP / LCP / TTI moments</span>
        <span>Click any marker or thumbnail to seek</span>
      </div>
    </CompareSection>
  );
}
