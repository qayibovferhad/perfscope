import { useState } from 'react';
import { Info } from 'lucide-react';
import type { CoreWebVitals } from '@/entities/analysis';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const BORD_DEFAULT = '1px solid rgba(255,255,255,0.09)';
const BORD_HOVER   = '1px solid rgba(139,92,246,0.55)';
const SHADOW_HOVER = '0 0 0 1px rgba(139,92,246,0.12), 0 4px 20px rgba(139,92,246,0.10)';

// ─── Metric definitions ───────────────────────────────────────────────────────

const METRICS = [
  {
    key: 'fcp' as const, abbr: 'FCP', label: 'First Contentful Paint',
    fmt: ms,  good: (v: number) => v < 1800, hint: '< 1.8s',
    tip: 'Time from navigation start until the browser renders the first piece of DOM content.',
  },
  {
    key: 'lcp' as const, abbr: 'LCP', label: 'Largest Contentful Paint',
    fmt: ms,  good: (v: number) => v < 2500, hint: '< 2.5s',
    tip: 'Time until the largest image or text block is visible in the viewport.',
  },
  {
    key: 'tbt' as const, abbr: 'TBT', label: 'Total Blocking Time',
    fmt: raw, good: (v: number) => v < 200,  hint: '< 200ms',
    tip: 'Sum of all periods between FCP and TTI where the main thread was blocked for ≥ 50 ms.',
  },
  {
    key: 'cls' as const, abbr: 'CLS', label: 'Cumulative Layout Shift',
    fmt: cls, good: (v: number) => v < 0.1,  hint: '< 0.1',
    tip: 'Measures the sum of all unexpected layout shift scores during page load.',
  },
  {
    key: 'si' as const, abbr: 'SI', label: 'Speed Index',
    fmt: ms,  good: (v: number) => v < 3400, hint: '< 3.4s',
    tip: 'How quickly content is visually populated — lower means the page feels snappier.',
  },
  {
    key: 'tti' as const, abbr: 'TTI', label: 'Time to Interactive',
    fmt: ms,  good: (v: number) => v < 3800, hint: '< 3.8s',
    tip: 'Time until the page is fully interactive — main thread quiet, event handlers ready.',
  },
];

function ms(v: number)  { return `${(v / 1000).toFixed(1)}s`; }
function raw(v: number) { return `${Math.round(v)}ms`; }
function cls(v: number) { return v.toFixed(3); }

// ─── Glassmorphism Tooltip ────────────────────────────────────────────────────

function GlassTooltip({ text }: { text: string }) {
  return (
    <div
      className="absolute bottom-full left-1/2 mb-2 w-52 rounded-xl px-3 py-2.5 text-[10px] leading-relaxed pointer-events-none z-50"
      style={{
        transform:      'translateX(-50%)',
        background:     'rgba(13,18,36,0.88)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border:         '1px solid rgba(139,92,246,0.28)',
        color:          '#cbd5e1',
        boxShadow:      '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(139,92,246,0.08)',
      }}
    >
      {/* Arrow */}
      <div
        className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
        style={{
          borderLeft:  '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop:   '5px solid rgba(139,92,246,0.28)',
        }}
      />
      {text}
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
  abbr, label, hint, tip, value, isGood,
}: {
  abbr: string; label: string; hint: string; tip: string;
  value: string; isGood: boolean;
}) {
  const [hovered,     setHovered]     = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const accent = isGood ? '#4ade80' : '#fbbf24';

  return (
    <div
      className="px-4 py-3.5 flex flex-col gap-2"
      style={{
        background:   'rgba(255,255,255,0.03)',
        border:       hovered ? BORD_HOVER : BORD_DEFAULT,
        borderRadius: '0.875rem',
        boxShadow:    hovered ? SHADOW_HOVER : 'none',
        transition:   'border 0.18s ease, box-shadow 0.18s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setTooltipOpen(false); }}
    >
      {/* Top row: label + info icon + threshold hint */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>
              {abbr}
            </span>
            <p className="text-[8px] mt-0.5 leading-tight" style={{ color: '#475569' }}>{label}</p>
          </div>

          {/* Info icon with tooltip */}
          <div
            className="relative ml-0.5 mt-0.5 self-start"
            onMouseEnter={() => setTooltipOpen(true)}
            onMouseLeave={() => setTooltipOpen(false)}
          >
            <Info
              className="w-3 h-3 cursor-help shrink-0 transition-colors duration-150"
              style={{ color: tooltipOpen ? '#818cf8' : '#334155' }}
            />
            {tooltipOpen && <GlassTooltip text={tip} />}
          </div>
        </div>

        <span className="text-[8px] font-medium" style={{ color: accent + '99' }}>{hint}</span>
      </div>

      {/* Value */}
      <p
        className="text-[1.55rem] font-black tabular-nums antialiased leading-none"
        style={{ color: '#ffffff', letterSpacing: '0.02em' }}
      >
        {value}
      </p>

      {/* Status */}
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />
        <span className="text-[9px] font-semibold" style={{ color: accent }}>
          {isGood ? 'Good' : 'Needs Work'}
        </span>
      </div>
    </div>
  );
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

export function CompareMetricsGrid({ metrics }: { metrics: CoreWebVitals }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {METRICS.map(({ key, abbr, label, fmt, good, hint, tip }) => (
        <MetricCard
          key={key}
          abbr={abbr}
          label={label}
          hint={hint}
          tip={tip}
          value={fmt(metrics[key])}
          isGood={good(metrics[key])}
        />
      ))}
    </div>
  );
}
