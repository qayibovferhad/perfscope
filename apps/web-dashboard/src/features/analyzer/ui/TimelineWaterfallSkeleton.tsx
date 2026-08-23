import { Network } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { LEFT_W, LEFT_W_NARROW, NARROW_QUERY, AXIS_ROW_H, METRICS_CFG } from '../lib/timelineWaterfall';
import { useMediaQuery } from '@/shared/lib/useMediaQuery';
import { TICK_COUNT } from '../lib/waterfall';

/** One shimmering block — same emerald sweep the live bars use while pending. */
function WfShim({ className, delay = 0, style }: { className?: string; delay?: number; style?: React.CSSProperties }) {
  return (
    <div
      className={cn('wf-sk-shim bg-ld-surface-2', className)}
      style={{ ...style, ['--wf-sk-delay' as string]: `${delay}ms` }}
    />
  );
}

/** Bar widths that read like a real request cascade rather than a uniform block. */
const SK_ROWS = [
  { left: 0,  width: 34 }, { left: 4,  width: 22 }, { left: 8,  width: 41 },
  { left: 12, width: 18 }, { left: 15, width: 29 }, { left: 22, width: 13 },
  { left: 26, width: 47 }, { left: 31, width: 20 }, { left: 38, width: 26 },
  { left: 44, width: 16 },
];

/**
 * Stands in for the whole panel while the audit is still streaming.
 * Every measurement it lays out is imported from ../lib/timelineWaterfall, the same
 * module the live panel reads, so the two cannot drift and nothing shifts when the data
 * lands. That is the placeholder's whole contract.
 */
export function TimelineWaterfallSkeleton() {
  // The placeholder's whole job is to occupy the space the real panel will, so it has to
  // narrow its name column on the same breakpoint.
  const leftW = useMediaQuery(NARROW_QUERY) ? LEFT_W_NARROW : LEFT_W;

  return (
    <div className="rounded-[18px] border border-ld-border bg-ld-surface shadow-ld-shadow-card overflow-hidden">
      <style>{`
        @keyframes wf-sk-shimmer {
          0%   { transform: translateX(-100%); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateX(250%); opacity: 0; }
        }
        .wf-sk-shim { position: relative; overflow: hidden; }
        .wf-sk-shim::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(20,192,138,0.22) 50%, transparent 100%);
          animation: wf-sk-shimmer 1.3s ease-in-out infinite;
          animation-delay: var(--wf-sk-delay, 0ms);
        }
      `}</style>

      {/* ── Panel head ─────────────────────────────────────────────────── */}
      <div className="border-b border-ld-border">
        <div className="flex items-center gap-[10px] px-[18px] py-[14px] flex-wrap">
          <span className="w-[34px] h-[34px] rounded-[9px] grid place-items-center bg-ld-surface-2 border border-ld-border [&_svg]:w-[17px] [&_svg]:h-[17px] text-ld-accent shrink-0">
            <Network />
          </span>
          <h3 className="text-[16.5px] font-bold text-ld-text tracking-tight">Network Waterfall</h3>
          <span className="font-mono text-[12px] text-ld-text-3">collecting requests…</span>

          <div className="flex items-center gap-[8px]">
            <WfShim className="h-[27px] w-[64px] rounded-[8px]" />
            <WfShim className="h-[25px] w-[62px] rounded-[8px]" delay={80} />
            <span className="text-[11px] font-mono font-bold tabular-nums px-[8px] py-[5px] rounded-[7px] border border-ld-accent-line bg-ld-accent-soft text-ld-accent shrink-0">
              0ms
            </span>
          </div>

          <div className="ml-auto flex items-center gap-[8px]">
            {METRICS_CFG.map((m, i) => (
              <span
                key={m.key}
                className={cn(
                  'hidden min-[900px]:inline-flex items-center gap-[6px] font-mono text-[11px] font-semibold px-[9px] py-[4px] rounded-[7px] opacity-50',
                  m.chipCls,
                )}
              >
                <span className={cn('w-[7px] h-[7px] rounded-full shrink-0 animate-pulse', m.lineCls)} style={{ animationDelay: `${i * 140}ms` }} />
                {m.label}
              </span>
            ))}
            <WfShim className="w-[120px] h-[68px] rounded-[10px] border border-ld-border-strong shrink-0" delay={160} />
          </div>
        </div>

        {/* ── Scrubber — aligned with the live one ─────────────────────── */}
        <div className="pb-3 pl-[298px] pr-[18px]">
          <div className="relative h-4 flex items-center">
            <div className="absolute inset-x-0 h-1 rounded-full bg-ld-border-strong overflow-hidden">
              <div className="wf-sk-shim h-full w-full bg-ld-border-strong" />
            </div>
            <div className="absolute left-0 w-3.5 h-3.5 rounded-full -translate-x-1/2 z-20 border-2 bg-ld-surface border-ld-border-strong" />
          </div>
        </div>

        {/* ── Column headers + filmstrip axis ─────────────────────────── */}
        <div className="flex border-t border-ld-border text-[10px] font-semibold uppercase tracking-widest text-ld-text-3">
          <div className="shrink-0 flex items-center gap-4 px-3 border-r border-ld-border" style={{ width: leftW, height: AXIS_ROW_H }}>
            <span>Resource</span>
            <span className="ml-auto">Type</span>
            <span className="w-11 text-right">Size</span>
          </div>

          <div className="flex-1 relative overflow-hidden" style={{ height: AXIS_ROW_H }}>
            {Array.from({ length: TICK_COUNT + 1 }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'absolute top-2 flex flex-col',
                  i === 0 ? 'items-start translate-x-0' : i === 6 ? 'items-end -translate-x-full' : 'items-center -translate-x-1/2',
                )}
                style={{ left: `${(i / TICK_COUNT) * 100}%` }}
              >
                <WfShim className="w-[80px] h-[45px] rounded-[5px] border border-ld-border" delay={i * 70} />
                <div className="h-1.5 w-px mt-0.5 bg-ld-border-strong" />
                <WfShim className="w-6 h-2 rounded-[3px] mt-1" delay={i * 70} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Rows ───────────────────────────────────────────────────────── */}
      <div className="rounded-b-[18px] overflow-hidden bg-ld-bg">
        <div className="relative">
          {/* Grid lines, same 6 ticks as the live chart */}
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: leftW, right: 0 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="absolute top-0 bottom-0 w-px bg-ld-border" style={{ left: `${((i + 1) / TICK_COUNT) * 100}%` }} />
            ))}
          </div>

          {SK_ROWS.map((r, i) => (
            <div
              key={i}
              className={cn('flex items-center border-b border-ld-border', i % 2 === 0 ? 'bg-ld-surface' : 'bg-ld-bg')}
            >
              <div className="flex items-center gap-2 px-3 py-1 shrink-0 border-r border-ld-border" style={{ width: leftW }}>
                <WfShim className="w-3 h-3 rounded-[3px] shrink-0" delay={i * 60} />
                <WfShim className="h-2.5 rounded-[3px] flex-1" delay={i * 60} style={{ maxWidth: 90 + ((i * 37) % 70) }} />
                <WfShim className="w-[30px] h-[14px] rounded-[5px] shrink-0" delay={i * 60} />
                <WfShim className="w-11 h-2.5 rounded-[3px] shrink-0" delay={i * 60} />
              </div>

              <div className="flex-1 relative h-5 flex items-center">
                <div className="absolute inset-x-0 h-px bg-ld-border" />
                <WfShim
                  className="absolute h-2.5 rounded-sm"
                  delay={i * 60}
                  style={{ left: `${r.left}%`, width: `${r.width}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
