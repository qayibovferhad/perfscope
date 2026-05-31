import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Layers, Cpu, AlertTriangle, ExternalLink } from 'lucide-react';
import type { AnalysisResult, FlameChartData } from '@/entities/analysis';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  background:     'var(--ps-panel-bg)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border:         '1px solid var(--ps-panel-border)',
  borderRadius:   '1rem',
  overflow:       'hidden',
};

const DIVIDER = 'var(--ps-divider)';
const T_HEX   = '#8B5CF6';   // violet-500
const C_HEX   = '#F59E0B';   // amber-500
const T_GLOW  = 'rgba(139,92,246,0.60)';
const C_GLOW  = 'rgba(245,158,11,0.60)';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(2)} MB`;
  if (b >= 1024)      return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function pct(winner: number, loser: number): string {
  if (!loser) return '';
  const p = Math.round(((loser - winner) / loser) * 100);
  return p > 0 ? `${p}% less` : '';
}

function computeCpu(data?: FlameChartData | null): Record<string, number> {
  if (!data) return {};
  const totals: Record<string, number> = {};
  for (const e of data.events) {
    if (e.depth !== 0) continue;           // top-level only to avoid double-counting
    totals[e.category] = (totals[e.category] ?? 0) + e.durationMs;
  }
  return totals;
}

function fileName(url: string): string {
  try { return new URL(url).pathname.split('/').pop() || url; }
  catch { return url.split('/').pop() || url; }
}

// ─── Mirror Bar Row ───────────────────────────────────────────────────────────

function MirrorRow({
  label, tVal, cVal, fmtFn, lowerIsBetter = true, delay = 0,
}: {
  label: string; tVal: number; cVal: number;
  fmtFn: (v: number) => string; lowerIsBetter?: boolean; delay?: number;
}) {
  // Bar widths proportional to COMBINED total so each bar reflects
  // its share of the sum — gives immediate visual "who owns more weight"
  const combined = (tVal + cVal) || 1;
  const tW     = (tVal / combined) * 100;
  const cW     = (cVal / combined) * 100;
  const tWins  = lowerIsBetter ? tVal <= cVal : tVal >= cVal;
  const cWins  = !tWins;
  const badge  = tWins ? pct(tVal, cVal) : pct(cVal, tVal);

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className="grid items-center gap-3 py-2.5 px-5 rounded-lg transition-colors"
      style={{ gridTemplateColumns: '120px 80px 1fr 80px 90px', background: 'rgba(255,255,255,0.02)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
    >
      {/* Label */}
      <span className="text-[11px] font-semibold" style={{ color: '#94a3b8' }}>{label}</span>

      {/* Your value */}
      <div className="text-right">
        <span
          className="text-[12px] font-bold tabular-nums antialiased"
          style={{ color: tWins ? '#ffffff' : 'rgba(255,255,255,0.38)', letterSpacing: '0.01em' }}
        >
          {fmtFn(tVal)}
        </span>
      </div>

      {/* Double-sided bar */}
      <div className="flex items-center gap-0" style={{ height: '8px' }}>
        {/* Left half — You, grows from center-left */}
        <div className="flex-1 flex justify-end overflow-hidden" style={{ height: '100%', borderRadius: '99px 0 0 99px', background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${tW}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: delay + 0.1 }}
            style={{
              height: '100%',
              borderRadius: '99px 0 0 99px',
              background: tWins ? `linear-gradient(270deg, ${T_HEX}, #a78bfa)` : `${T_HEX}38`,
              boxShadow:  tWins ? `0 0 10px ${T_GLOW}` : 'none',
            }}
          />
        </div>
        {/* Center pin */}
        <div style={{ width: '1.5px', height: '14px', flexShrink: 0, background: 'rgba(255,255,255,0.15)' }} />
        {/* Right half — Rival, grows from center-right */}
        <div className="flex-1 flex justify-start overflow-hidden" style={{ height: '100%', borderRadius: '0 99px 99px 0', background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${cW}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: delay + 0.1 }}
            style={{
              height: '100%',
              borderRadius: '0 99px 99px 0',
              background: cWins ? `linear-gradient(90deg, ${C_HEX}, #fcd34d)` : `${C_HEX}38`,
              boxShadow:  cWins ? `0 0 10px ${C_GLOW}` : 'none',
            }}
          />
        </div>
      </div>

      {/* Rival value */}
      <div className="text-left">
        <span
          className="text-[12px] font-bold tabular-nums antialiased"
          style={{ color: cWins ? '#ffffff' : 'rgba(255,255,255,0.38)', letterSpacing: '0.01em' }}
        >
          {fmtFn(cVal)}
        </span>
      </div>

      {/* Winner badge */}
      <div className="flex justify-end">
        {badge ? (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
            style={{
              color:      tWins ? T_HEX : C_HEX,
              background: tWins ? 'rgba(139,92,246,0.14)' : 'rgba(245,158,11,0.14)',
              border:     `1px solid ${tWins ? 'rgba(139,92,246,0.35)' : 'rgba(245,158,11,0.35)'}`,
            }}
          >
            {tWins ? 'You' : 'Rival'} · {badge}
          </span>
        ) : (
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Sub-section header ───────────────────────────────────────────────────────

function SubHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${DIVIDER}` }}>
      <span style={{ color: '#64748b' }}>{icon}</span>
      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>{title}</span>
    </div>
  );
}

// ─── Column labels ────────────────────────────────────────────────────────────

function ColHeader() {
  return (
    <div
      className="grid items-center gap-3 px-5 py-2"
      style={{ gridTemplateColumns: '120px 80px 1fr 80px 90px', borderBottom: `1px solid ${DIVIDER}` }}
    >
      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.20)' }}>Category</span>
      <span className="text-[9px] font-bold uppercase tracking-widest text-right" style={{ color: T_HEX + '80' }}>You</span>
      <div className="flex justify-between px-1 text-[9px] font-bold uppercase tracking-widest">
        <span style={{ color: T_HEX + '60' }}>← You</span>
        <span style={{ color: C_HEX + '60' }}>Rival →</span>
      </div>
      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C_HEX + '80' }}>Rival</span>
      <span className="text-[9px] font-bold uppercase tracking-widest text-right" style={{ color: 'rgba(255,255,255,0.20)' }}>Delta</span>
    </div>
  );
}

// ─── Resource Distribution ────────────────────────────────────────────────────

const RESOURCE_ROWS = [
  { key: 'script'     as const, label: 'JavaScript' },
  { key: 'image'      as const, label: 'Images'     },
  { key: 'stylesheet' as const, label: 'CSS'        },
  { key: 'font'       as const, label: 'Fonts'      },
  { key: 'media'      as const, label: 'Media'      },
  { key: 'other'      as const, label: 'Other'      },
];

function ResourceDistribution({
  tRes, cRes,
}: {
  tRes: AnalysisResult['resources'];
  cRes: AnalysisResult['resources'];
}) {
  if (!tRes || !cRes) return null;

  const rows = RESOURCE_ROWS.filter(
    ({ key }) => tRes.summary[key].transferSize > 0 || cRes.summary[key].transferSize > 0,
  );

  return (
    <div>
      <SubHeader icon={<Layers className="w-3.5 h-3.5" />} title="Resource Distribution (Transfer Size)" />
      <ColHeader />
      <div className="space-y-0.5 py-2 px-2">
        {rows.map(({ key, label }, i) => (
          <MirrorRow
            key={key}
            label={label}
            tVal={tRes.summary[key].transferSize}
            cVal={cRes.summary[key].transferSize}
            fmtFn={fmtBytes}
            delay={i * 0.05}
          />
        ))}
      </div>
      {/* Totals */}
      <div
        className="flex items-center justify-between px-5 py-2.5 mx-5 mb-3 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>Total Weight</span>
        <div className="flex items-center gap-6">
          <span className="text-[13px] font-black tabular-nums" style={{ color: T_HEX }}>
            {fmtBytes(tRes.summary.total.transferSize)}
          </span>
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.20)' }}>vs</span>
          <span className="text-[13px] font-black tabular-nums" style={{ color: C_HEX }}>
            {fmtBytes(cRes.summary.total.transferSize)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── CPU Execution Cost ───────────────────────────────────────────────────────

const CPU_ROWS = [
  { key: 'scripting',  label: 'Scripting'  },
  { key: 'rendering',  label: 'Rendering'  },
  { key: 'painting',   label: 'Painting'   },
  { key: 'other',      label: 'Other CPU'  },
];

function CpuExecution({
  tData, cData,
}: {
  tData?: FlameChartData | null;
  cData?: FlameChartData | null;
}) {
  const tCpu = useMemo(() => computeCpu(tData), [tData]);
  const cCpu = useMemo(() => computeCpu(cData), [cData]);

  if (!tData && !cData) return null;

  const rows = CPU_ROWS.filter(({ key }) => (tCpu[key] ?? 0) > 0 || (cCpu[key] ?? 0) > 0);
  if (!rows.length) return null;

  return (
    <div style={{ borderTop: `1px solid ${DIVIDER}` }}>
      <SubHeader icon={<Cpu className="w-3.5 h-3.5" />} title="CPU Main Thread Execution" />
      <ColHeader />
      <div className="space-y-0.5 py-2 px-2">
        {rows.map(({ key, label }, i) => (
          <MirrorRow
            key={key}
            label={label}
            tVal={tCpu[key] ?? 0}
            cVal={cCpu[key] ?? 0}
            fmtFn={fmtMs}
            delay={i * 0.05}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Oversized Resources ──────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  script:     'Script',
  stylesheet: 'CSS',
  image:      'Image',
  font:       'Font',
  media:      'Media',
  document:   'Document',
  other:      'Other',
};

function OversizedResources({
  tRes, cRes,
}: {
  tRes: AnalysisResult['resources'];
  cRes: AnalysisResult['resources'];
}) {
  const items = useMemo(() => {
    const t = (tRes?.requests ?? []).filter(r => r.isCritical).map(r => ({ ...r, side: 'target' as const }));
    const c = (cRes?.requests ?? []).filter(r => r.isCritical).map(r => ({ ...r, side: 'competitor' as const }));
    return [...t, ...c].sort((a, b) => b.transferSize - a.transferSize);
  }, [tRes, cRes]);

  if (!items.length) return null;

  return (
    <div style={{ borderTop: `1px solid ${DIVIDER}` }}>
      <SubHeader
        icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
        title={`Oversized Resources (${items.length})`}
      />
      <div className="space-y-0.5 py-2 px-3">
        {items.map((req, i) => {
          const isTarget = req.side === 'target';
          const color    = isTarget ? T_HEX : C_HEX;
          const name     = fileName(req.url);

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              className="grid items-center gap-3 px-3 py-2.5 rounded-lg"
              style={{
                gridTemplateColumns: '1fr 80px 90px 100px',
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid rgba(255,255,255,0.06)`,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.045)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            >
              {/* File name */}
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: color }}
                />
                <a
                  href={req.url}
                  target="_blank"
                  rel="noreferrer"
                  title={req.url}
                  className="text-[11px] font-mono truncate flex items-center gap-1 hover:underline"
                  style={{ color: '#cbd5e1' }}
                  onClick={e => e.stopPropagation()}
                >
                  {name}
                  <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-40" />
                </a>
              </div>

              {/* Type */}
              <span className="text-[10px]" style={{ color: '#64748b' }}>
                {TYPE_LABELS[req.resourceType] ?? req.resourceType}
              </span>

              {/* Size */}
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="text-[11px] font-bold tabular-nums text-amber-400">
                  {fmtBytes(req.transferSize)}
                </span>
              </div>

              {/* Side badge */}
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap justify-self-end"
                style={{
                  color,
                  background: isTarget ? 'rgba(139,92,246,0.14)' : 'rgba(245,158,11,0.14)',
                  border:     `1px solid ${color}44`,
                }}
              >
                {isTarget ? '← Your Site' : 'Competitor →'}
              </span>
            </motion.div>
          );
        })}
      </div>
      <p className="px-5 py-3 text-[9px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
        JS &gt; 500 KB or Images &gt; 1 MB are flagged. Optimize with compression, lazy loading, or code-splitting.
      </p>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function DeepComparison({
  target, competitor,
}: {
  target: AnalysisResult; competitor: AnalysisResult;
}) {
  const hasResources = target.resources || competitor.resources;
  const hasCpu       = target.flameChartData || competitor.flameChartData;
  const hasOversized = [
    ...(target.resources?.requests ?? []),
    ...(competitor.resources?.requests ?? []),
  ].some(r => r.isCritical);

  console.log(hasResources,'hasResources');
  console.log(hasCpu,'hasCpu');
  
  if (!hasResources && !hasCpu && !hasOversized) return null;
  console.log(hasOversized,'hasOversized');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={PANEL}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: `1px solid ${DIVIDER}` }}
      >
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>Deep Comparison</span>
        </div>
        <div className="flex items-center gap-4 text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: T_HEX }} />
            Your Site
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: C_HEX }} />
            Competitor
          </span>
        </div>
      </div>

      <ResourceDistribution tRes={target.resources} cRes={competitor.resources} />
      <CpuExecution         tData={target.flameChartData}  cData={competitor.flameChartData}  />
      <OversizedResources   tRes={target.resources} cRes={competitor.resources} />
    </motion.div>
  );
}
