import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Info, Zap, Star } from 'lucide-react';
import type { AnalysisResult, CoreWebVitals } from '@/entities/analysis';


const PANEL_BG  = 'var(--ps-panel-bg)';
const ROW_BASE  = 'rgba(255,255,255,0.025)';
const ROW_HOVER = 'rgba(255,255,255,0.055)';
const DIVIDER   = 'var(--ps-divider)';

const T_HEX  = '#818cf8';  
const C_HEX  = '#fb923c';   
const T_GLOW = 'rgba(129,140,248,0.80)';
const C_GLOW = 'rgba(251,146,60,0.80)';


interface MetricDef {
  key:           keyof CoreWebVitals;
  abbr:          string;
  label:         string;
  lowerIsBetter: boolean;
  fmt:           (v: number) => string;
  tip:           string;
}

const METRICS: MetricDef[] = [
  { key: 'lcp', abbr: 'LCP', label: 'Largest Contentful Paint', lowerIsBetter: true, fmt: v => `${(v/1000).toFixed(2)}s`,  tip: 'Time until the largest element is rendered' },
  { key: 'fcp', abbr: 'FCP', label: 'First Contentful Paint',   lowerIsBetter: true, fmt: v => `${(v/1000).toFixed(2)}s`,  tip: 'Time until the first content appears'       },
  { key: 'tbt', abbr: 'TBT', label: 'Total Blocking Time',      lowerIsBetter: true, fmt: v => `${Math.round(v)}ms`,        tip: 'Sum of all long task blocking periods'       },
  { key: 'tti', abbr: 'TTI', label: 'Time to Interactive',      lowerIsBetter: true, fmt: v => `${(v/1000).toFixed(2)}s`,  tip: 'When the page becomes fully interactive'    },
  { key: 'si',  abbr: 'SI',  label: 'Speed Index',              lowerIsBetter: true, fmt: v => `${(v/1000).toFixed(2)}s`,  tip: 'How quickly content is visually populated'  },
  { key: 'cls', abbr: 'CLS', label: 'Cumulative Layout Shift',  lowerIsBetter: true, fmt: v => v.toFixed(3),               tip: 'Measures unexpected layout shifts'          },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function winPct(winner: number, loser: number): number {
  if (!loser || winner === loser) return 0;
  return Math.round(Math.abs((loser - winner) / loser) * 100);
}

function badgeText(pct: number): string {
  if (pct >= 60) return 'Dominating';
  if (pct >= 25) return 'Top Performer';
  if (pct >= 5)  return 'Leading';
  return '';
}

function barWidths(tVal: number, cVal: number, lowerIsBetter: boolean) {
  if (tVal === cVal) return { tW: 50, cW: 50, tWins: false, cWins: false };
  const tWins = lowerIsBetter ? tVal < cVal : tVal > cVal;
  const cWins = !tWins;
  if (tWins) {
    const ratio = lowerIsBetter ? tVal / cVal : cVal / tVal;
    return { tW: 100, cW: Math.round(ratio * 100), tWins, cWins };
  }
  const ratio = lowerIsBetter ? cVal / tVal : tVal / cVal;
  return { tW: Math.round(ratio * 100), cW: 100, tWins, cWins };
}


function HeroCircle({
  score, color, glow, label, isWinner,
}: {
  score: number; color: string; glow: string; label: string; isWinner: boolean;
}) {
  const arcRef = useRef<SVGCircleElement>(null);
  const SIZE = 180; const R = 68; const CIRCUM = 2 * Math.PI * R;

  useEffect(() => {
    if (!arcRef.current) return;
    arcRef.current.style.strokeDashoffset = String(CIRCUM - (score / 100) * CIRCUM);
  }, [score, CIRCUM]);

  return (
    <motion.div
      className="flex flex-col items-center gap-4"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative" style={{ width: SIZE, height: SIZE }}>

        {isWinner && (
          <div
            className="absolute rounded-full blur-3xl"
            style={{
              inset: '-20px',
              background: glow.replace('0.80', '0.10'),
            }}
          />
        )}

        {isWinner && [0, 1].map(i => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full"
            style={{ border: `1.5px solid ${color}` }}
            animate={{ scale: [1, 1.18], opacity: [0.45, 0] }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: 'easeOut',
              delay: i * 1.1,
            }}
          />
        ))}

        <svg
          width={SIZE} height={SIZE}
          style={{
            transform: 'rotate(-90deg)',
            filter: isWinner ? `drop-shadow(0 0 18px ${glow})` : 'none',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
            stroke="rgba(255,255,255,0.04)" strokeWidth={13} />
          <circle ref={arcRef} cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
            stroke={color} strokeWidth={13} strokeLinecap="round"
            style={{
              strokeDasharray: CIRCUM,
              strokeDashoffset: CIRCUM,
              transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)',
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ zIndex: 2 }}>
          <span
            className="text-[2.8rem] font-black tabular-nums leading-none"
            style={{
              color: isWinner ? '#ffffff' : 'rgba(255,255,255,0.65)',
              textShadow: isWinner ? `0 0 28px ${glow}, 0 0 56px ${glow.replace('0.80','0.4')}` : 'none',
            }}
          >
            {score}
          </span>
          <span className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.28)' }}>/ 100</span>
        </div>

        {isWinner && (
          <div
            className="absolute z-10 flex items-center justify-center w-7 h-7 rounded-full"
            style={{
              top: '-4px', right: '-4px',
              background: 'rgba(251,191,36,0.18)',
              border: '1.5px solid rgba(251,191,36,0.6)',
              boxShadow: '0 0 14px rgba(251,191,36,0.35)',
            }}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
          </div>
        )}
      </div>

      <div className="text-center space-y-0.5">
        <p className="text-[13px] font-semibold" style={{ color: '#cbd5e1' }}>{label}</p>
        {isWinner && (
          <p
            className="text-[11px] font-bold text-amber-400"
            style={{ textShadow: '0 0 12px rgba(251,191,36,0.5)' }}
          >
            Overall Winner
          </p>
        )}
      </div>
    </motion.div>
  );
}


function MirrorBar({ tW, cW, tWins, cWins }: {
  tW: number; cW: number; tWins: boolean; cWins: boolean;
}) {
  return (
    <div className="flex items-center w-full" style={{ height: '10px', gap: 0 }}>
      <div
        className="flex-1 flex justify-end overflow-hidden"
        style={{ height: '100%', borderRadius: '99px 0 0 99px', background: 'rgba(255,255,255,0.06)' }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${tW}%` }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
          style={{
            height: '100%',
            borderRadius: '99px 0 0 99px',
            background: tWins
              ? `linear-gradient(270deg, ${T_HEX} 0%, #c7d2fe 100%)`
              : `${T_HEX}28`,
            boxShadow: tWins
              ? `0 0 15px rgba(139,92,246,0.55), 0 0 30px rgba(139,92,246,0.30)`
              : 'none',
          }}
        />
      </div>

      <div
        style={{
          width: '1.5px', height: '18px', flexShrink: 0, zIndex: 10,
          background: 'rgba(255,255,255,0.22)',
        }}
      />

      <div
        className="flex-1 flex justify-start overflow-hidden"
        style={{ height: '100%', borderRadius: '0 99px 99px 0', background: 'rgba(255,255,255,0.06)' }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${cW}%` }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
          style={{
            height: '100%',
            borderRadius: '0 99px 99px 0',
            background: cWins
              ? `linear-gradient(90deg, ${C_HEX} 0%, #fed7aa 100%)`
              : `${C_HEX}28`,
            boxShadow: cWins
              ? `0 0 15px rgba(249,115,22,0.55), 0 0 30px rgba(249,115,22,0.30)`
              : 'none',
          }}
        />
      </div>
    </div>
  );
}

// ─── Champion badge ───────────────────────────────────────────────────────────

function ChampionBadge({ pct, color, side }: {
  pct: number; color: string; glow?: string; side: 'you' | 'rival';
}) {
  const title = badgeText(pct);
  if (!title) return null;

  const rgb = color.slice(1).match(/.{2}/g)!.map(x => parseInt(x, 16)).join(',');

  return (
    <span
      className="inline-flex items-center gap-1.5 font-bold whitespace-nowrap"
      style={{
        fontSize: '10px',
        color: '#ffffff',
        padding: '4px 9px',
        borderRadius: '8px',
        background:     `rgba(${rgb}, 0.18)`,
        border:         `1px solid rgba(${rgb}, 0.55)`,
        backdropFilter: 'blur(10px)',
        boxShadow:      `0 0 16px rgba(${rgb}, 0.28), inset 0 1px 0 rgba(255,255,255,0.10)`,
      }}
    >
      <Star
        className="shrink-0"
        style={{ width: '10px', height: '10px', color, fill: color }}
      />
      <span style={{ color: 'rgba(255,255,255,0.95)' }}>{side === 'you' ? 'You' : 'Rival'}</span>
      <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: '9px' }}>·</span>
      <span style={{ color }}>{title}</span>
      {pct >= 5 && (
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '9px' }}>{pct}%</span>
      )}
    </span>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

function MetricRow({ def, tVal, cVal, index }: {
  def: MetricDef; tVal: number; cVal: number; index: number;
}) {
  const { abbr, label, lowerIsBetter, fmt, tip } = def;
  const { tW, cW, tWins, cWins } = barWidths(tVal, cVal, lowerIsBetter);
  const tPct = tWins ? winPct(tVal, cVal) : 0;
  const cPct = cWins ? winPct(cVal, tVal) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.08 + index * 0.055 }}
      className="grid items-center gap-x-4 px-5 py-3.5 rounded-xl transition-colors"
      style={{
        gridTemplateColumns: 'minmax(110px,160px) 80px 1fr 80px minmax(80px,150px)',
        background: ROW_BASE,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = ROW_HOVER)}
      onMouseLeave={e => (e.currentTarget.style.background = ROW_BASE)}
    >
      {/* Metric name + info */}
      <div className="flex items-center gap-1.5">
        <div>
          <span className="text-[12px] font-extrabold" style={{ color: '#cbd5e1' }}>{abbr}</span>
          <p className="text-[9px] mt-0.5 hidden sm:block" style={{ color: '#94a3b8' }}>{label}</p>
        </div>
        <div className="relative group/tip">
          <Info
            className="w-3 h-3 cursor-help shrink-0"
            style={{ color: '#475569' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
          />
          <div
            className="absolute left-0 top-5 z-20 hidden group-hover/tip:block w-44 rounded-lg px-2.5 py-2 text-[10px] leading-snug pointer-events-none"
            style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}
          >
            {tip}
          </div>
        </div>
      </div>

      {/* Your value */}
      <div className="text-right">
        <span
          className="text-[14px] font-extrabold tabular-nums antialiased"
          style={{
            color: tWins ? '#ffffff' : 'rgba(255,255,255,0.62)',
            letterSpacing: '0.02em',
            textShadow: tWins ? `0 0 14px ${T_GLOW}, 0 0 28px rgba(129,140,248,0.35)` : 'none',
          }}
        >
          {fmt(tVal)}
        </span>
      </div>

      {/* Mirror bar */}
      <MirrorBar tW={tW} cW={cW} tWins={tWins} cWins={cWins} />

      {/* Rival value */}
      <div className="text-left">
        <span
          className="text-[14px] font-extrabold tabular-nums antialiased"
          style={{
            color: cWins ? '#ffffff' : 'rgba(255,255,255,0.62)',
            letterSpacing: '0.02em',
            textShadow: cWins ? `0 0 14px ${C_GLOW}, 0 0 28px rgba(251,146,60,0.35)` : 'none',
          }}
        >
          {fmt(cVal)}
        </span>
      </div>

      {/* Champion badge */}
      <div className="flex justify-end">
        {tWins && tPct >= 5 ? (
          <ChampionBadge pct={tPct} color={T_HEX} glow={T_GLOW} side="you" />
        ) : cWins && cPct >= 5 ? (
          <ChampionBadge pct={cPct} color={C_HEX} glow={C_GLOW} side="rival" />
        ) : (
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.18)' }}>Tied</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Scoreboard ──────────────────────────────────────────────────────────

export function ComparisonScoreboard({
  target, competitor,
}: {
  target: AnalysisResult; competitor: AnalysisResult;
}) {
  const tScore = Math.round(target.scores.performance);
  const cScore = Math.round(competitor.scores.performance);
  const diff   = Math.abs(tScore - cScore);
  const tWins  = tScore > cScore;
  const cWins  = cScore > tScore;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background:     PANEL_BG,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-6 py-4"
        style={{ borderBottom: `1px solid ${DIVIDER}` }}
      >
        <Trophy className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>Performance Scoreboard</span>
      </div>

      {/* Hero circles */}
      <div
        className="flex items-center justify-center gap-10 sm:gap-20 py-10"
        style={{ borderBottom: `1px solid ${DIVIDER}` }}
      >
        <HeroCircle score={tScore} color={T_HEX} glow={T_GLOW} label="Your Site"  isWinner={tWins} />

        <div className="flex flex-col items-center gap-2 select-none">
          <span
            className="font-black leading-none"
            style={{ fontSize: '3.2rem', color: 'rgba(255,255,255,0.07)', letterSpacing: '0.3em' }}
          >
            VS
          </span>
          {diff > 0 && (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-2xl font-black" style={{ color: 'rgba(255,255,255,0.70)' }}>
                +{diff}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: '#64748b' }}>
                pts diff
              </span>
            </div>
          )}
        </div>

        <HeroCircle score={cScore} color={C_HEX} glow={C_GLOW} label="Competitor" isWinner={cWins} />
      </div>

      {/* Table header */}
      <div
        className="grid items-center gap-x-4 px-5 py-2.5"
        style={{
          gridTemplateColumns: 'minmax(110px,160px) 80px 1fr 80px minmax(80px,150px)',
          borderBottom: `1px solid ${DIVIDER}`,
        }}
      >
        {['Metric', 'Your Value', '', 'Rival Value', 'Status'].map((col, i) => (
          <div key={i} className={i === 1 ? 'text-right' : i === 3 ? 'text-left' : i === 4 ? 'text-right' : ''}>
            {i === 2 ? (
              <div className="flex items-center justify-between px-1 text-[9px] font-bold uppercase tracking-widest">
                <span style={{ color: T_HEX + '70' }}>← You</span>
                <span style={{ color: C_HEX + '70' }}>Rival →</span>
              </div>
            ) : (
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.22)' }}>
                {col}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Table rows */}
      <div className="px-2 py-3 space-y-0.5">
        {METRICS.map((m, i) => (
          <MetricRow
            key={m.key}
            def={m}
            tVal={target.metrics[m.key]}
            cVal={competitor.metrics[m.key]}
            index={i}
          />
        ))}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-center gap-6 px-6 py-3 flex-wrap"
        style={{ borderTop: `1px solid ${DIVIDER}` }}
      >
        {[
          { color: T_HEX, text: 'Your Site' },
          { color: C_HEX, text: 'Competitor' },
        ].map(({ color, text }) => (
          <span key={text} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
            <span className="inline-block w-3 h-1.5 rounded-full" style={{ background: color }} />
            {text}
          </span>
        ))}
        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
        <span className="text-[10px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.18)' }}>
          <Zap className="w-2.5 h-2.5" />
          Brighter bar = better
        </span>
      </div>
    </div>
  );
}
