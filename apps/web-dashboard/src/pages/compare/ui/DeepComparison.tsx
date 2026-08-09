import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Layers, Cpu, AlertTriangle, ExternalLink } from 'lucide-react';
import type { AnalysisResult, FlameChartData } from '@/entities/analysis';

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
    if (e.depth !== 0) continue;
    totals[e.category] = (totals[e.category] ?? 0) + e.durationMs;
  }
  return totals;
}

function fileName(url: string): string {
  try { return new URL(url).pathname.split('/').pop() || url; }
  catch { return url.split('/').pop() || url; }
}

// ─── Sub-section label ────────────────────────────────────────────────────────

function SubLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-[9px] mb-[14px]">
      <span className="text-ld-text-3 flex items-center">{icon}</span>
      <span className="text-[12px] font-bold text-ld-text-2 uppercase tracking-[.06em]">{title}</span>
    </div>
  );
}

// ─── Column header ────────────────────────────────────────────────────────────

function ColHeader() {
  return (
    <div className="grid grid-cols-[120px_80px_1fr_80px_90px] gap-3 px-3 pb-[10px] mb-1">
      <span className="font-mono text-[9px] font-bold uppercase tracking-[.1em] text-ld-text-3">Category</span>
      <span className="font-mono text-[9px] font-bold uppercase tracking-[.1em] text-ld-accent-2 text-right">You</span>
      <div className="flex items-center justify-between px-[2px]">
        <span className="font-mono text-[9px] text-ld-accent-2 opacity-60">← You</span>
        <span className="font-mono text-[9px] text-ld-amber opacity-60">Rival →</span>
      </div>
      <span className="font-mono text-[9px] font-bold uppercase tracking-[.1em] text-ld-amber">Rival</span>
      <span className="font-mono text-[9px] font-bold uppercase tracking-[.1em] text-ld-text-3 text-right">Delta</span>
    </div>
  );
}

// ─── Mirror bar row ───────────────────────────────────────────────────────────

function MirrorRow({
  label, tVal, cVal, fmtFn, lowerIsBetter = true, delay = 0,
}: {
  label: string; tVal: number; cVal: number;
  fmtFn: (v: number) => string; lowerIsBetter?: boolean; delay?: number;
}) {
  const combined = (tVal + cVal) || 1;
  const tW    = (tVal / combined) * 100;
  const cW    = (cVal / combined) * 100;
  const tWins = lowerIsBetter ? tVal <= cVal : tVal >= cVal;
  const cWins = !tWins;
  const badge = tWins ? pct(tVal, cVal) : pct(cVal, tVal);

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className="grid grid-cols-[120px_80px_1fr_80px_90px] items-center gap-3 py-[10px] px-3 rounded-[10px] transition-colors hover:bg-ld-surface-2 cursor-default"
    >
      <span className="text-[11px] font-semibold text-ld-text-2">{label}</span>

      {/* You value */}
      <div className="text-right">
        <span className={`text-[12px] font-bold tabular-nums tracking-[0.01em]
          ${tWins ? 'text-ld-accent-2' : 'text-ld-text-3'}`}>
          {fmtFn(tVal)}
        </span>
      </div>

      {/* Double-sided bar */}
      <div className="flex items-center h-[8px]">
        {/* Left half — You, grows leftward from center */}
        <div className="flex-1 flex justify-end overflow-hidden h-full rounded-l-full bg-ld-border">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${tW}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: delay + 0.1 }}
            className={`h-full rounded-l-full
              ${tWins
                ? 'bg-gradient-to-l from-ld-accent to-ld-accent-soft'
                : 'bg-ld-accent-soft'}`}
          />
        </div>
        <div className="w-[1.5px] h-[14px] shrink-0 bg-ld-border-strong" />
        {/* Right half — Rival, grows rightward from center */}
        <div className="flex-1 flex justify-start overflow-hidden h-full rounded-r-full bg-ld-border">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${cW}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: delay + 0.1 }}
            className={`h-full rounded-r-full
              ${cWins
                ? 'bg-gradient-to-r from-ld-amber to-[rgba(230,162,60,0.13)]'
                : 'bg-[rgba(230,162,60,0.13)]'}`}
          />
        </div>
      </div>

      {/* Rival value */}
      <span className={`text-[12px] font-bold tabular-nums tracking-[0.01em]
        ${cWins ? 'text-ld-amber' : 'text-ld-text-3'}`}>
        {fmtFn(cVal)}
      </span>

      {/* Winner badge */}
      <div className="flex justify-end">
        {badge ? (
          <span className={`text-[9px] font-bold px-[7px] py-[3px] rounded-[6px] whitespace-nowrap
            ${tWins
              ? 'text-ld-accent-2 bg-ld-accent-soft border border-ld-accent-line'
              : 'text-ld-amber bg-[rgba(230,162,60,0.13)] border border-[rgba(230,162,60,0.34)]'}`}>
            {tWins ? 'You' : 'Rival'} · {badge}
          </span>
        ) : (
          <span className="text-[9px] text-ld-text-3">—</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Resource distribution ────────────────────────────────────────────────────

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
      <SubLabel icon={<Layers className="w-[14px] h-[14px]" />} title="Resource Distribution · Transfer Size" />
      <ColHeader />
      <div className="space-y-[2px]">
        {rows.map(({ key, label }, i) => (
          <MirrorRow
            key={key} label={label}
            tVal={tRes.summary[key].transferSize}
            cVal={cRes.summary[key].transferSize}
            fmtFn={fmtBytes} delay={i * 0.05}
          />
        ))}
      </div>

      {/* Total weight row */}
      <div className="flex items-center justify-between px-4 py-[10px] mx-1 mt-3 rounded-[10px] bg-ld-surface-2 border border-ld-border">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em] text-ld-text-3">Total Weight</span>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[13px] font-black tabular-nums text-ld-accent-2">
            {fmtBytes(tRes.summary.total.transferSize)}
          </span>
          <span className="text-[9px] text-ld-text-3">vs</span>
          <span className="font-mono text-[13px] font-black tabular-nums text-ld-amber">
            {fmtBytes(cRes.summary.total.transferSize)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── CPU execution ────────────────────────────────────────────────────────────

const CPU_ROWS = [
  { key: 'scripting', label: 'Scripting' },
  { key: 'rendering', label: 'Rendering' },
  { key: 'painting',  label: 'Painting'  },
  { key: 'other',     label: 'Other CPU' },
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
    <div className="pt-[22px] mt-[22px] border-t border-ld-border">
      <SubLabel icon={<Cpu className="w-[14px] h-[14px]" />} title="CPU Main Thread Execution" />
      <ColHeader />
      <div className="space-y-[2px]">
        {rows.map(({ key, label }, i) => (
          <MirrorRow
            key={key} label={label}
            tVal={tCpu[key] ?? 0}
            cVal={cCpu[key] ?? 0}
            fmtFn={fmtMs} delay={i * 0.05}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Oversized resources ──────────────────────────────────────────────────────

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
    <div className="pt-[22px] mt-[22px] border-t border-ld-border">
      <SubLabel
        icon={<AlertTriangle className="w-[14px] h-[14px] text-ld-amber" />}
        title={`Oversized Resources (${items.length})`}
      />
      <div className="space-y-[3px]">
        {items.map((req, i) => {
          const isTarget = req.side === 'target';
          const name     = fileName(req.url);

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              className="grid grid-cols-[1fr_80px_90px_100px] items-center gap-3 px-3 py-[10px] rounded-[10px] transition-colors hover:bg-ld-surface-2 border border-ld-border cursor-default"
            >
              {/* File name */}
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${isTarget ? 'bg-ld-accent' : 'bg-ld-amber'}`} />
                <a
                  href={req.url}
                  target="_blank"
                  rel="noreferrer"
                  title={req.url}
                  className="text-[11px] font-mono truncate flex items-center gap-1 text-ld-text-2 hover:text-ld-text hover:underline transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  {name}
                  <ExternalLink className="w-[10px] h-[10px] shrink-0 opacity-40" />
                </a>
              </div>

              {/* Type */}
              <span className="text-[10px] text-ld-text-3">
                {TYPE_LABELS[req.resourceType] ?? req.resourceType}
              </span>

              {/* Size */}
              <div className="flex items-center gap-[6px]">
                <AlertTriangle className="w-[12px] h-[12px] text-ld-amber shrink-0" />
                <span className="font-mono text-[11px] font-bold tabular-nums text-ld-amber">
                  {fmtBytes(req.transferSize)}
                </span>
              </div>

              {/* Side badge */}
              <span className={`text-[9px] font-bold px-[7px] py-[3px] rounded-[6px] whitespace-nowrap justify-self-end
                ${isTarget
                  ? 'text-ld-accent-2 bg-ld-accent-soft border border-ld-accent-line'
                  : 'text-ld-amber bg-[rgba(230,162,60,0.13)] border border-[rgba(230,162,60,0.34)]'}`}>
                {isTarget ? '← Your Site' : 'Competitor →'}
              </span>
            </motion.div>
          );
        })}
      </div>
      <p className="mt-[10px] text-[10px] text-ld-text-3">
        JS &gt; 500 KB or Images &gt; 1 MB are flagged. Optimize with compression, lazy loading, or code-splitting.
      </p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

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

  if (!hasResources && !hasCpu && !hasOversized) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-[20px] border border-ld-border bg-ld-surface shadow-ld-shadow-card p-[26px]"
    >
      {/* Head with legend */}
      <div className="flex items-center justify-between mb-[22px]">
        <div className="flex items-center gap-[11px]">
          <div className="w-8 h-8 rounded-[9px] grid place-items-center bg-ld-surface-2 border border-ld-border text-ld-accent shrink-0">
            <Layers className="w-[16px] h-[16px]" />
          </div>
          <h2 className="text-[16px] font-bold tracking-[-0.01em] text-ld-text">Deep Comparison</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-[7px] text-[11px] text-ld-text-3">
            <span className="w-2 h-2 rounded-full bg-ld-accent shrink-0" />
            Your Site
          </span>
          <span className="flex items-center gap-[7px] text-[11px] text-ld-text-3">
            <span className="w-2 h-2 rounded-full bg-ld-amber shrink-0" />
            Competitor
          </span>
        </div>
      </div>

      <ResourceDistribution tRes={target.resources}          cRes={competitor.resources} />
      <CpuExecution         tData={target.flameChartData}    cData={competitor.flameChartData} />
      <OversizedResources   tRes={target.resources}          cRes={competitor.resources} />
    </motion.div>
  );
}
