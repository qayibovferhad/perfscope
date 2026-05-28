import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { Film, Play, Pause, Clock } from 'lucide-react';
import type { AnalysisResult, TimelineData, TimelineFrame } from '../../analyzer/types';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  background:     'var(--ps-panel-bg)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border:         '1px solid var(--ps-panel-border)',
  borderRadius:   '1rem',
  overflow:       'hidden',
};

const T_HEX   = '#8B5CF6';
const C_HEX   = '#F59E0B';
const T_GLOW  = 'rgba(139,92,246,0.55)';
const C_GLOW  = 'rgba(245,158,11,0.55)';
const DIVIDER = 'var(--ps-divider)';

const METRIC_DEFS = [
  { key: 'fcp' as const, label: 'FCP', color: '#3b82f6', glow: 'rgba(59,130,246,0.5)'  },
  { key: 'lcp' as const, label: 'LCP', color: '#10b981', glow: 'rgba(16,185,129,0.5)'  },
  { key: 'tti' as const, label: 'TTI', color: '#f97316', glow: 'rgba(249,115,22,0.5)'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

function findFrameAt(frames: TimelineFrame[], ms: number): TimelineFrame {
  if (!frames.length) return { timing: 0, data: '' };
  let best = frames[0];
  for (const f of frames) {
    if (f.timing <= ms) best = f;
    else break;
  }
  return best;
}

// Returns METRIC_DEFS entries whose timing falls closest to this frame
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

// ─── FrameImage — shimmer skeleton + error guard ──────────────────────────────

type ImgStatus = 'loading' | 'ready' | 'error';

const FrameImage = memo(function FrameImage({
  src, alt, width, height, imgStyle, eager = false,
}: {
  src: string; alt: string; width: number; height: number;
  imgStyle?: React.CSSProperties; eager?: boolean;
}) {
  const [status, setStatus] = useState<ImgStatus>(() => src ? 'loading' : 'error');
  useEffect(() => { setStatus(src ? 'loading' : 'error'); }, [src]);

  return (
    <div style={{ width, height, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      {status === 'loading' && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ background: 'linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 100%)' }}
        />
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1"
          style={{ background: 'rgba(255,255,255,0.03)' }}>
          <Film className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.15)' }} />
          <span className="text-[7px]" style={{ color: 'rgba(255,255,255,0.20)' }}>N/A</span>
        </div>
      )}
      {src && (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          draggable={false}
          onLoad={()  => setStatus('ready')}
          onError={() => setStatus('error')}
          style={{
            ...imgStyle,
            width, height,
            objectFit: 'cover',
            display: status === 'ready' ? 'block' : 'none',
          }}
        />
      )}
    </div>
  );
});

// ─── Single thumbnail ─────────────────────────────────────────────────────────

const Thumb = memo(function Thumb({
  frame, frames, metrics, isActive, totalMs, accentColor, accentGlow, onClick,
}: {
  frame: TimelineFrame; frames: TimelineFrame[];
  metrics: TimelineData['metrics'];
  isActive: boolean; totalMs: number;
  accentColor: string; accentGlow: string;
  onClick: () => void;
}) {
  const loadPct  = totalMs > 0 ? Math.round((frame.timing / totalMs) * 100) : 0;
  const badges   = useMemo(
    () => metricBadgesForFrame(frame, frames, metrics),
    [frame, frames, metrics],
  );

  return (
    <button onClick={onClick} className="flex flex-col gap-1 shrink-0" style={{ width: 80 }}>
      <div
        className="relative overflow-hidden rounded-md transition-all duration-150"
        style={{
          border:    isActive ? `2px solid ${accentColor}` : '2px solid rgba(255,255,255,0.08)',
          boxShadow: isActive ? `0 0 12px ${accentGlow}` : 'none',
        }}
      >
        <FrameImage
          key={frame.timing}
          src={frame.data}
          alt={fmt(frame.timing)}
          width={76}
          height={56}
          imgStyle={{ opacity: isActive ? 1 : 0.55 }}
        />

        {/* Metric badges — top-right corner */}
        {badges.length > 0 && (
          <div className="absolute top-1 right-1 flex flex-col gap-0.5 z-20">
            {badges.map(m => (
              <span
                key={m.key}
                className="text-[7px] font-black px-1 py-0 rounded leading-tight"
                style={{
                  background: `${m.color}dd`,
                  color:      '#ffffff',
                  boxShadow:  `0 0 6px ${m.glow}`,
                }}
              >
                {m.label}
              </span>
            ))}
          </div>
        )}

        {/* Timing badge */}
        <div
          className="absolute bottom-0 inset-x-0 text-center text-[8px] font-bold tabular-nums py-0.5 z-10"
          style={{
            background: 'rgba(0,0,0,0.72)',
            color: isActive ? accentColor : 'rgba(255,255,255,0.45)',
          }}
        >
          {fmt(frame.timing)}
        </div>
      </div>

      {/* Loading progress bar */}
      <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width:      `${loadPct}%`,
            background: isActive
              ? `linear-gradient(90deg, ${accentColor}, ${accentColor}99)`
              : 'rgba(255,255,255,0.18)',
            boxShadow: isActive ? `0 0 6px ${accentGlow}` : 'none',
          }}
        />
      </div>
      <span className="text-[8px] text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
        {loadPct}%
      </span>
    </button>
  );
});

// ─── Filmstrip Row ────────────────────────────────────────────────────────────

function FilmstripRow({
  label, color, glow, data, currentMs, totalMs, onSeek, nearbyMetricColor,
}: {
  label: string; color: string; glow: string;
  data: TimelineData; currentMs: number; totalMs: number;
  onSeek: (ms: number) => void;
  nearbyMetricColor?: string;
}) {
  const active      = findFrameAt(data.frames, currentMs);
  const borderColor = nearbyMetricColor ?? color;
  const borderGlow  = nearbyMetricColor
    ? `${nearbyMetricColor}90`
    : glow;

  return (
    <div className="flex flex-col gap-3">
      {/* Row label + seek-to-metric pills */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
        </div>
        {METRIC_DEFS.map(m => {
          const val = data.metrics[m.key];
          if (!val) return null;
          return (
            <button
              key={m.key}
              onClick={() => onSeek(val)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold hover:opacity-80 transition-opacity"
              style={{ background: `${m.color}18`, border: `1px solid ${m.color}50`, color: m.color }}
              title={`Seek to ${m.label}: ${fmt(val)}`}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.color }} />
              {m.label} {fmt(val)}
            </button>
          );
        })}
      </div>

      {/* Thumbnail strip LEFT, Active Frame RIGHT */}
      <div className="flex gap-3 items-start">

        {/* Scrollable thumbnail strip */}
        <div
          className="flex gap-1.5 overflow-x-auto pb-1 flex-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        >
          {data.frames.map((frame, i) => (
            <Thumb
              key={i}
              frame={frame}
              frames={data.frames}
              metrics={data.metrics}
              isActive={frame === active}
              totalMs={totalMs}
              accentColor={color}
              accentGlow={glow}
              onClick={() => onSeek(frame.timing)}
            />
          ))}
        </div>

        {/* Active Frame — large, rightmost, border syncs with nearby metric */}
        <div
          className="shrink-0 rounded-lg overflow-hidden transition-all duration-200"
          style={{
            border:    `2px solid ${borderColor}`,
            boxShadow: `0 0 20px ${borderGlow}, 0 0 40px ${borderGlow.replace('90','40')}`,
            width: 148,
          }}
        >
          <FrameImage
            key={active.timing}
            src={active.data}
            alt="Active frame"
            width={144}
            height={108}
            eager
          />
          <div
            className="text-center text-[10px] font-bold tabular-nums py-1"
            style={{ background: 'rgba(0,0,0,0.80)', color: borderColor }}
          >
            {fmt(active.timing)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Track Marker (triangle + tooltip) ───────────────────────────────────────

function TrackMarker({
  metricLabel, sideLabel, color, glow, timeMs, left, direction, onClick,
}: {
  metricLabel: string; sideLabel: string; color: string; glow: string;
  timeMs: number; left: string; direction: 'up' | 'down'; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  // Triangle CSS via inline borders
  const triangle: React.CSSProperties = direction === 'up'
    ? { borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: `8px solid ${color}`, width: 0, height: 0 }
    : { borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop:    `8px solid ${color}`, width: 0, height: 0 };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute -translate-x-1/2 flex flex-col items-center group"
      style={{
        left,
        [direction === 'up' ? 'bottom' : 'top']: 0,
        zIndex: hovered ? 30 : 10,
      }}
    >
      {/* Label above (up markers) */}
      {direction === 'up' && (
        <span className="text-[8px] font-bold mb-0.5 whitespace-nowrap transition-all duration-100"
          style={{
            color,
            opacity: hovered ? 1 : 0.75,
            textShadow: hovered ? `0 0 8px ${glow}` : 'none',
          }}>
          {metricLabel}
        </span>
      )}

      {/* Triangle */}
      <div
        style={{
          ...triangle,
          filter: hovered ? `drop-shadow(0 0 4px ${glow})` : 'none',
          transition: 'filter 0.15s',
        }}
      />

      {/* Label below (down markers) */}
      {direction === 'down' && (
        <span className="text-[8px] font-bold mt-0.5 whitespace-nowrap transition-all duration-100"
          style={{
            color,
            opacity: hovered ? 1 : 0.65,
            textShadow: hovered ? `0 0 8px ${glow}` : 'none',
          }}>
          {metricLabel}
        </span>
      )}

      {/* Glassmorphism tooltip */}
      {hovered && (
        <div
          className="absolute whitespace-nowrap px-2.5 py-1.5 rounded-lg text-[10px] font-semibold pointer-events-none z-50"
          style={{
            [direction === 'up' ? 'bottom' : 'top']: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: direction === 'down' ? 6 : 0,
            marginBottom: direction === 'up' ? 6 : 0,
            background:     'rgba(13,18,36,0.92)',
            backdropFilter: 'blur(12px)',
            border:         `1px solid ${color}45`,
            color:          '#ffffff',
            boxShadow:      `0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px ${color}20`,
          }}
        >
          <span style={{ color }}>{sideLabel}</span>
          <span style={{ color: 'rgba(255,255,255,0.45)', margin: '0 4px' }}>·</span>
          <span>{metricLabel}: {fmt(timeMs)}</span>
        </div>
      )}
    </button>
  );
}

// ─── Shared Timeline Axis ─────────────────────────────────────────────────────

function TimeAxis({
  tData, cData, currentMs, totalMs, isPlaying, onSeek, onTogglePlay,
}: {
  tData?: TimelineData | null; cData?: TimelineData | null;
  currentMs: number; totalMs: number;
  isPlaying: boolean; onSeek: (ms: number) => void; onTogglePlay: () => void;
}) {
  const pct = (ms: number) => `${((ms / totalMs) * 100).toFixed(2)}%`;

  return (
    <div
      className="px-5 py-3 space-y-0"
      style={{ borderTop: `1px solid ${DIVIDER}`, borderBottom: `1px solid ${DIVIDER}` }}
    >

      {/* ── YOUR SITE track (above scrubber, markers pointing UP) ── */}
      <div
        className="relative rounded-t-lg overflow-visible"
        style={{ height: 44, background: `${T_HEX}08`, borderBottom: `1.5px solid ${T_HEX}30` }}
      >
        {/* Left label */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1 pl-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: T_HEX }} />
          <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: T_HEX + '99' }}>Your Site</span>
        </div>

        {/* Markers */}
        {tData && METRIC_DEFS.map(m => {
          const val = tData.metrics[m.key];
          if (!val || val > totalMs) return null;
          return (
            <TrackMarker
              key={m.key}
              metricLabel={m.label}
              sideLabel="Your Site"
              color={m.color}
              glow={m.glow}
              timeMs={val}
              left={pct(val)}
              direction="up"
              onClick={() => onSeek(val)}
            />
          );
        })}
      </div>

      {/* ── Scrubber row ── */}
      <div className="flex items-center gap-3 py-2.5 px-1">
        <button
          onClick={onTogglePlay}
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
            type="range" min={0} max={totalMs} step={16} value={currentMs}
            onChange={e => onSeek(Number(e.target.value))}
            className="w-full appearance-none h-1.5 rounded-full outline-none cursor-pointer"
            style={{ background: `linear-gradient(to right, ${T_HEX} ${pct(currentMs)}, rgba(255,255,255,0.12) ${pct(currentMs)})` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full pointer-events-none"
            style={{ left: pct(currentMs), background: '#ffffff', boxShadow: `0 0 8px ${T_GLOW}`, border: `2px solid ${T_HEX}` }}
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Clock className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.35)' }} />
          <span className="text-[11px] font-mono tabular-nums" style={{ color: 'rgba(255,255,255,0.60)' }}>
            {fmt(currentMs)}
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>/ {fmt(totalMs)}</span>
        </div>
      </div>

      {/* ── COMPETITOR track (below scrubber, markers pointing DOWN) ── */}
      <div
        className="relative rounded-b-lg overflow-visible"
        style={{ height: 44, background: `${C_HEX}08`, borderTop: `1.5px solid ${C_HEX}30` }}
      >
        {/* Left label */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1 pl-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C_HEX }} />
          <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: C_HEX + '99' }}>Competitor</span>
        </div>

        {/* Markers */}
        {cData && METRIC_DEFS.map(m => {
          const val = cData.metrics[m.key];
          if (!val || val > totalMs) return null;
          return (
            <TrackMarker
              key={m.key}
              metricLabel={m.label}
              sideLabel="Competitor"
              color={m.color}
              glow={m.glow}
              timeMs={val}
              left={pct(val)}
              direction="down"
              onClick={() => onSeek(val)}
            />
          );
        })}
      </div>

      {/* Tick labels */}
      <div className="flex justify-between pt-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="text-[8px] tabular-nums" style={{ color: 'rgba(255,255,255,0.18)' }}>
            {fmt((i / 4) * totalMs)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FilmstripComparison({
  target, competitor,
}: {
  target: AnalysisResult; competitor: AnalysisResult;
}) {
  const tData = target.timelineData;
  const cData = competitor.timelineData;

  if (!tData && !cData) return null;

  const totalMs = Math.max(
    tData?.frames.at(-1)?.timing ?? 0,
    cData?.frames.at(-1)?.timing ?? 0,
  );

  const [currentMs, setCurrentMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Metric whose moment the scrubber is within ±400ms of — used to sync active frame border
  const NEAR_MS = 400;
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

  // RAF-based 60fps playback
  const rafRef      = useRef<number | null>(null);
  const startRef    = useRef<number>(0);   // wall-clock when play started
  const startMsRef  = useRef<number>(0);   // timeline ms when play started

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
      const elapsed = now - startRef.current;
      const ms = startMsRef.current + elapsed;
      if (ms >= totalMs) {
        setCurrentMs(totalMs);
        setIsPlaying(false);
        return;
      }
      setCurrentMs(ms);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [totalMs]);

  // Clean up on unmount
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const seek = useCallback((ms: number) => {
    stopPlay();
    setCurrentMs(Math.max(0, Math.min(ms, totalMs)));
  }, [totalMs, stopPlay]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopPlay();
    } else {
      const from = currentMs >= totalMs ? 0 : currentMs;
      if (from === 0) setCurrentMs(0);
      startPlay(from);
    }
  }, [isPlaying, currentMs, totalMs, stopPlay, startPlay]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={PANEL}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${DIVIDER}` }}>
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>Filmstrip Comparison</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
            Synchronized Playback
          </span>
        </div>
        <div className="flex items-center gap-4 text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
          {METRIC_DEFS.map(m => (
            <span key={m.key} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: m.color }} />
              {m.label}
            </span>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {tData && (
          <FilmstripRow label="Your Site" color={T_HEX} glow={T_GLOW}
            data={tData} currentMs={currentMs} totalMs={totalMs} onSeek={seek}
            nearbyMetricColor={nearbyMetricColor} />
        )}

        <TimeAxis
          tData={tData} cData={cData}
          currentMs={currentMs} totalMs={totalMs}
          isPlaying={isPlaying} onSeek={seek} onTogglePlay={togglePlay}
        />

        {cData && (
          <FilmstripRow label="Competitor" color={C_HEX} glow={C_GLOW}
            data={cData} currentMs={currentMs} totalMs={totalMs} onSeek={seek}
            nearbyMetricColor={nearbyMetricColor} />
        )}
      </div>

      {/* Footer legend */}
      <div
        className="flex items-center justify-center gap-6 px-6 py-3 flex-wrap text-[9px]"
        style={{ borderTop: `1px solid ${DIVIDER}`, color: 'rgba(255,255,255,0.22)' }}
      >
        <span>● Your Site markers</span>
        <span>◎ Competitor markers</span>
        <span>Colored badges on frames indicate FCP / LCP / TTI moments</span>
        <span>Click any marker or thumbnail to seek</span>
      </div>
    </motion.div>
  );
}
