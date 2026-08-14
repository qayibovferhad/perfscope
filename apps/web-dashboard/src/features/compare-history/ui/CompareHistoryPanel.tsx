import { useState, useEffect, useRef } from 'react';
import { Spinner } from '@/shared/ui/spinner';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, GitCompareArrows, ChevronDown, Trophy,
  TrendingUp, TrendingDown, Minus, Zap, Lightbulb, FileText,
} from 'lucide-react';
import { useCompareHistoryList, useCompareHistoryPair, type CompareEntry } from '../model/useCompareHistory';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Panel } from '@/shared/ui/panel';
import { StatePanel } from '@/shared/ui/state-panel';
import { fmtMs, fmtCls } from '@/shared/lib/format';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function trendNote(entries: CompareEntry[]): string | null {
  if (entries.length < 2) return null;
  const last = perf(entries.at(-1)!, 'source') - perf(entries.at(-1)!, 'competitor');
  const prev = perf(entries.at(-2)!, 'source') - perf(entries.at(-2)!, 'competitor');
  return Math.abs(last) < Math.abs(prev) ? 'Gap narrowing vs prev run' : 'Gap widening vs prev run';
}

function buildInsight(e: CompareEntry): string {
  const sm = e.source.metrics;
  const cm = e.competitor.metrics;
  const ys = perf(e, 'source');
  const cs = perf(e, 'competitor');

  if (ys >= cs) {
    const rivals = (
      [
        (cm['lcp'] ?? 0) < (sm['lcp'] ?? 0) * 0.85 && 'LCP',
        (cm['fcp'] ?? 0) < (sm['fcp'] ?? 0) * 0.85 && 'FCP',
        (cm['tbt'] ?? 0) < (sm['tbt'] ?? 0) * 0.80 && 'TBT',
      ] as (string | false)[]
    ).filter(Boolean) as string[];
    if (!rivals.length) return 'You lead across all metrics. Maintain your performance budget to keep widening this margin.';
    return `You lead on score but the competitor edges you on ${rivals.join(' and ')}. Tightening those metrics will solidify your advantage.`;
  }

  const adv = (
    [
      (cm['lcp'] ?? 0) < (sm['lcp'] ?? 0) * 0.85 && 'LCP',
      (cm['fcp'] ?? 0) < (sm['fcp'] ?? 0) * 0.85 && 'FCP',
      (cm['tbt'] ?? 0) < (sm['tbt'] ?? 0) * 0.80 && 'TBT',
    ] as (string | false)[]
  ).filter(Boolean) as string[];

  const str = (
    [
      (sm['cls'] ?? 0) < (cm['cls'] ?? 0) * 0.80 && 'CLS',
      (sm['tbt'] ?? 0) < (cm['tbt'] ?? 0) * 0.80 && 'TBT',
    ] as (string | false)[]
  ).filter(Boolean) as string[];

  const leadOn   = adv.length ? adv.join(' and ') : 'overall score';
  const strength = str.length
    ? ` Your ${str.join(' and ')} ${str.length > 1 ? 'are' : 'is'} competitive; closing the paint-time gap would flip several runs in your favour.`
    : '';
  return `The competitor leads mostly on ${leadOn} — they ship a lighter critical path.${strength}`;
}

// Safely bolds metric abbreviations without dangerouslySetInnerHTML
function Highlight({ text }: { text: string }) {
  const METRICS = ['LCP', 'TBT', 'FCP', 'CLS', 'INP'];
  const parts   = text.split(new RegExp(`\\b(${METRICS.join('|')})\\b`));
  return (
    <>
      {parts.map((p, i) =>
        METRICS.includes(p)
          ? <b key={i} className="text-ld-text font-semibold">{p}</b>
          : p
      )}
    </>
  );
}

// ─── Search Bar ───────────────────────────────────────────────────────────────

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      icon={<Search />}
      type="text"
      placeholder="Search by rival URL…"
      value={value}
      onChange={e => onChange(e.target.value)}
      wrapperClassName="mb-[18px]"
    />
  );
}

// ─── Compare Row ─────────────────────────────────────────────────────────────

function CompareRow({
  entry,
  selected,
  onToggle,
}: {
  entry:    CompareEntry;
  selected: boolean;
  onToggle: () => void;
}) {
  const ys    = perf(entry, 'source');
  const cs    = perf(entry, 'competitor');
  const delta = ys - cs;
  const youWin = entry.winner === 'source';
  const isTie  = entry.winner === 'tie';

  return (
    <div
      onClick={onToggle}
      className={`grid items-center gap-x-[16px] gap-y-[10px] px-[20px] py-[16px] border-b border-ld-border last:border-b-0 cursor-pointer transition-[background] duration-[160ms]
        [grid-template-columns:1.4fr_1.4fr_auto_auto_auto_26px]
        max-[820px]:[grid-template-columns:1fr_1fr_26px]
        ${selected ? 'bg-ld-accent-soft' : 'hover:bg-ld-surface-2'}`}
    >
      {/* You side */}
      <div className="flex items-center gap-[10px] min-w-0">
        <span
          className="w-[9px] h-[9px] rounded-full shrink-0"
          style={{ background: 'var(--ld-accent)', boxShadow: '0 0 0 3px var(--ld-accent-soft)' }}
        />
        <div className="min-w-0">
          <b className="block text-[14px] font-semibold text-ld-text truncate">{entry.sourceHostname}</b>
          <span className="block font-mono text-[11.5px] text-ld-text-3 truncate">{entry.sourceUrl}</span>
        </div>
        <span className="font-mono text-[9px] font-semibold tracking-[.08em] px-[7px] py-[2px] rounded-[5px] shrink-0 bg-ld-accent-soft text-ld-accent-2">
          YOU
        </span>
      </div>

      {/* Rival side */}
      <div className="flex items-center gap-[10px] min-w-0">
        <span
          className="w-[9px] h-[9px] rounded-full shrink-0"
          style={{ background: 'var(--ld-amber)', boxShadow: '0 0 0 3px rgba(230,162,60,.14)' }}
        />
        <div className="min-w-0">
          <b className="block text-[14px] font-semibold text-ld-text truncate">{entry.targetHostname}</b>
          <span className="block font-mono text-[11.5px] text-ld-text-3 truncate">{entry.targetUrl}</span>
        </div>
        <span
          className="font-mono text-[9px] font-semibold tracking-[.08em] px-[7px] py-[2px] rounded-[5px] shrink-0"
          style={{ color: 'var(--ld-amber)', background: 'rgba(230,162,60,.12)' }}
        >
          RIVAL
        </span>
      </div>

      {/* Scores: you · rival */}
      <div className="text-center min-w-[88px] max-[820px]:[grid-column:1] max-[820px]:justify-self-start max-[820px]:text-left">
        <p className="font-mono text-[9px] tracking-[.10em] uppercase text-ld-text-3 mb-[5px]">Performance</p>
        <div className="inline-flex items-baseline gap-[6px]">
          <span className="font-mono text-[17px] font-semibold text-ld-accent-2">{ys}</span>
          <span className="font-mono text-[11px] text-ld-text-3">·</span>
          <span className="font-mono text-[17px] font-semibold" style={{ color: 'var(--ld-amber)' }}>{cs}</span>
        </div>
      </div>

      {/* Delta */}
      <div className={`inline-flex items-center gap-[5px] font-mono text-[13px] font-semibold justify-self-end whitespace-nowrap
        max-[820px]:[grid-column:2] max-[820px]:justify-self-end
        ${delta > 0 ? 'text-ld-accent-2' : delta < 0 ? 'text-ld-rose' : 'text-ld-text-3'}`}
      >
        {delta > 0
          ? <TrendingUp   className="w-[14px] h-[14px]" />
          : delta < 0
          ? <TrendingDown className="w-[14px] h-[14px]" />
          : <Minus        className="w-[14px] h-[14px]" />}
        {delta > 0 ? `+${delta}` : delta === 0 ? '±0' : delta}
      </div>

      {/* Winner pill */}
      {isTie ? (
        <div className="inline-flex items-center gap-[7px] font-mono text-[11px] font-semibold tracking-[.04em] px-[12px] py-[6px] rounded-full justify-self-end whitespace-nowrap border border-ld-border-strong text-ld-text-3 max-[820px]:[grid-column:1/-1] max-[820px]:justify-self-start">
          <Minus className="w-[13px] h-[13px]" /> Tie
        </div>
      ) : youWin ? (
        <div className="inline-flex items-center gap-[7px] font-mono text-[11px] font-semibold tracking-[.04em] px-[12px] py-[6px] rounded-full justify-self-end whitespace-nowrap border border-ld-accent-line bg-ld-accent-soft text-ld-accent-2 max-[820px]:[grid-column:1/-1] max-[820px]:justify-self-start">
          <Trophy className="w-[13px] h-[13px]" /> You win
        </div>
      ) : (
        <div
          className="inline-flex items-center gap-[7px] font-mono text-[11px] font-semibold tracking-[.04em] px-[12px] py-[6px] rounded-full justify-self-end whitespace-nowrap max-[820px]:[grid-column:1/-1] max-[820px]:justify-self-start"
          style={{ color: 'var(--ld-amber)', border: '1px solid rgba(230,162,60,.34)', background: 'rgba(230,162,60,.10)' }}
        >
          <Trophy className="w-[13px] h-[13px]" /> Rival wins
        </div>
      )}

      {/* Expand caret */}
      <span
        className={`justify-self-end w-[22px] h-[22px] grid place-items-center transition-[transform,color] duration-[250ms]
          max-[820px]:[grid-row:1] max-[820px]:[grid-column:3]
          ${selected ? 'text-ld-accent rotate-180' : 'text-ld-text-3'}`}
      >
        <ChevronDown className="w-[15px] h-[15px]" />
      </span>
    </div>
  );
}

import { PairChart } from './PairChart';
import { perf } from './pairMetrics';

// ─── Pair Detail ─────────────────────────────────────────────────────────────

function PairDetail({ pairId, entry }: { pairId: string; entry: CompareEntry }) {
  const { data: all = [], isLoading } = useCompareHistoryPair(pairId);
  const [exporting, setExporting]    = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const entries = all.length ? all : [entry];
  const last    = entries.at(-1)!;
  const ys      = perf(last, 'source');
  const cs      = perf(last, 'competitor');
  const youWin  = last.winner === 'source';
  const gap     = Math.abs(ys - cs);
  const trend   = trendNote(entries);
  const insight = buildInsight(last);
  const mOf     = (side: 'source' | 'competitor') => last[side].metrics;

  async function handleExport() {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, backgroundColor: isDark ? '#0e1712' : '#ffffff', useCORS: true, logging: false,
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pW  = pdf.internal.pageSize.getWidth();
      const pH  = pdf.internal.pageSize.getHeight();
      pdf.setFillColor(14, 23, 18); pdf.rect(0, 0, pW, pH, 'F');
      pdf.setTextColor(20, 192, 138); pdf.setFontSize(16); pdf.setFont('helvetica', 'bold');
      pdf.text('PerfScope', 12, 14);
      pdf.setTextColor(174, 188, 180); pdf.setFontSize(9); pdf.setFont('helvetica', 'normal');
      pdf.text(`${last.sourceHostname} vs ${last.targetHostname}`, 12, 28);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 12, 34);
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const imgW    = pW - 24;
      const imgH    = Math.min((canvas.height / canvas.width) * imgW, pH - 50);
      pdf.addImage(imgData, 'JPEG', 12, 42, imgW, imgH);
      pdf.save(`perfscope-${last.sourceHostname}-vs-${last.targetHostname}-${Date.now()}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Panel className="shadow-ld-shadow-card mt-[16px]">

      {/* Header */}
      <div className="flex items-center gap-[11px] px-[24px] py-[20px] border-b border-ld-border">
        <span className="w-[30px] h-[30px] rounded-[8px] grid place-items-center bg-ld-surface-2 border border-ld-border text-ld-accent shrink-0">
          <GitCompareArrows className="w-[15px] h-[15px]" />
        </span>
        <h3 className="text-[16px] font-bold text-ld-text">Pair Detail</h3>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={handleExport}
          disabled={exporting || isLoading}
        >
          <FileText />
          {exporting ? 'Generating…' : 'Generate Report'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="sm" />
        </div>
      ) : (
        <div ref={reportRef} className="px-[24px] py-[22px]">

          {/* Legend + metric tag */}
          <div className="flex items-center justify-between gap-[14px] mb-[16px] flex-wrap">
            <div className="flex gap-[16px]">
              <span className="inline-flex items-center gap-[8px] font-mono text-[11.5px] text-ld-text-3">
                <i className="w-[16px] h-[3px] rounded-[2px] bg-ld-accent block not-italic" />
                Your Site
              </span>
              <span className="inline-flex items-center gap-[8px] font-mono text-[11.5px] text-ld-text-3">
                <i className="w-[16px] h-[3px] rounded-[2px] block not-italic" style={{ background: 'var(--ld-amber)' }} />
                Competitor
              </span>
            </div>
            <span className="font-mono text-[11px] font-semibold text-ld-text-2 px-[13px] py-[6px] rounded-full border border-ld-border-strong">
              SCORE
            </span>
          </div>

          <PairChart entries={entries} />

          {/* Verdict banner */}
          <div
            className="flex items-center gap-[11px] mt-[18px] px-[16px] py-[13px] rounded-[12px] border flex-wrap"
            style={{ background: 'rgba(230,162,60,.08)', borderColor: 'rgba(230,162,60,.25)' }}
          >
            <span
              className="w-[26px] h-[26px] rounded-[7px] grid place-items-center shrink-0"
              style={{ background: 'rgba(230,162,60,.16)', color: 'var(--ld-amber)' }}
            >
              <Zap className="w-[15px] h-[15px]" />
            </span>
            <span className="text-[13.5px] text-ld-text font-semibold">
              {youWin
                ? <><b className="text-ld-accent-2">{last.sourceHostname}</b> is {gap} points ahead</>
                : <><b style={{ color: 'var(--ld-amber)' }}>{last.targetHostname}</b> is {gap} points ahead</>
              }
            </span>
            {trend && (
              <span className="ml-auto inline-flex items-center gap-[6px] font-mono text-[12px] font-semibold text-ld-accent-2 whitespace-nowrap">
                {trend.includes('narrowing')
                  ? <TrendingDown className="w-[13px] h-[13px]" />
                  : <TrendingUp   className="w-[13px] h-[13px]" />
                }
                {trend}
              </span>
            )}
          </div>

          {/* Senior insight */}
          <div className="flex gap-[12px] mt-[12px] px-[16px] py-[16px] rounded-[12px] bg-ld-surface-2 border border-ld-border">
            <span className="text-ld-accent shrink-0 mt-[1px]">
              <Lightbulb className="w-[18px] h-[18px]" />
            </span>
            <div>
              <div className="font-mono text-[10px] tracking-[.12em] uppercase text-ld-accent font-semibold mb-[6px]">
                Senior Insight
              </div>
              <p className="text-[13.5px] text-ld-text-2 leading-[1.55]">
                <Highlight text={insight} />
              </p>
            </div>
          </div>

          {/* Score cards */}
          <div className="grid grid-cols-2 max-[760px]:grid-cols-1 gap-[14px] mt-[14px]">

            {/* Your card */}
            <div
              className="rounded-[16px] bg-ld-surface-2 px-[20px] py-[20px] relative border"
              style={youWin
                ? { borderColor: 'var(--ld-amber)', boxShadow: '0 0 0 1px rgba(230,162,60,.18)' }
                : { borderColor: 'var(--ld-border)' }}
            >
              {youWin && (
                <span className="absolute top-[16px] right-[16px]" style={{ color: 'var(--ld-amber)' }}>
                  <Trophy className="w-[18px] h-[18px]" />
                </span>
              )}
              <div className="inline-flex items-center gap-[8px] font-mono text-[11px] font-semibold tracking-[.10em] uppercase text-ld-accent-2">
                <span className="w-[9px] h-[9px] rounded-full bg-ld-accent" />
                Your Site
              </div>
              <div className="font-mono text-[44px] font-semibold tracking-[-0.03em] text-ld-accent-2 mt-[14px] mb-[4px] leading-none">
                {ys}
              </div>
              <div className="font-mono text-[12px] text-ld-text-3 truncate">{last.sourceHostname}</div>
              <div className="flex gap-[14px] mt-[14px] flex-wrap">
                <span className="font-mono text-[11.5px] text-ld-text-3">LCP <b className="text-ld-text-2 font-semibold">{fmtMs(mOf('source')['lcp'] ?? 0)}</b></span>
                <span className="font-mono text-[11.5px] text-ld-text-3">CLS <b className="text-ld-text-2 font-semibold">{fmtCls(mOf('source')['cls'] ?? 0)}</b></span>
                <span className="font-mono text-[11.5px] text-ld-text-3">TBT <b className="text-ld-text-2 font-semibold">{fmtMs(mOf('source')['tbt'] ?? 0)}</b></span>
              </div>
            </div>

            {/* Rival card */}
            <div
              className="rounded-[16px] bg-ld-surface-2 px-[20px] py-[20px] relative border"
              style={!youWin
                ? { borderColor: 'var(--ld-amber)', boxShadow: '0 0 0 1px rgba(230,162,60,.18)' }
                : { borderColor: 'var(--ld-border)' }}
            >
              {!youWin && (
                <span className="absolute top-[16px] right-[16px]" style={{ color: 'var(--ld-amber)' }}>
                  <Trophy className="w-[18px] h-[18px]" />
                </span>
              )}
              <div
                className="inline-flex items-center gap-[8px] font-mono text-[11px] font-semibold tracking-[.10em] uppercase"
                style={{ color: 'var(--ld-amber)' }}
              >
                <span className="w-[9px] h-[9px] rounded-full" style={{ background: 'var(--ld-amber)' }} />
                Competitor
              </div>
              <div
                className="font-mono text-[44px] font-semibold tracking-[-0.03em] mt-[14px] mb-[4px] leading-none"
                style={{ color: 'var(--ld-amber)' }}
              >
                {cs}
              </div>
              <div className="font-mono text-[12px] text-ld-text-3 truncate">{last.targetHostname}</div>
              <div className="flex gap-[14px] mt-[14px] flex-wrap">
                <span className="font-mono text-[11.5px] text-ld-text-3">LCP <b className="text-ld-text-2 font-semibold">{fmtMs(mOf('competitor')['lcp'] ?? 0)}</b></span>
                <span className="font-mono text-[11.5px] text-ld-text-3">CLS <b className="text-ld-text-2 font-semibold">{fmtCls(mOf('competitor')['cls'] ?? 0)}</b></span>
                <span className="font-mono text-[11.5px] text-ld-text-3">TBT <b className="text-ld-text-2 font-semibold">{fmtMs(mOf('competitor')['tbt'] ?? 0)}</b></span>
              </div>
            </div>

          </div>
        </div>
      )}
    </Panel>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <StatePanel
      icon={<GitCompareArrows className="w-7 h-7" />}
      title="No comparisons yet"
      description="Run a competitive analysis to start tracking performance battles."
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/compare">
            <GitCompareArrows /> Go to Compare
          </Link>
        </Button>
      }
    />
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function CompareHistoryPanel() {
  const [localSearch, setLocalSearch] = useState('');
  const [apiSearch,   setApiSearch]   = useState('');
  const [selected, setSelected]       = useState<{ pairId: string; entry: CompareEntry } | null>(null);

  const { data: pairs = [], isLoading } = useCompareHistoryList(apiSearch);

  useEffect(() => {
    const t = setTimeout(() => setApiSearch(localSearch), 300);
    return () => clearTimeout(t);
  }, [localSearch]);

  function handleSearch(v: string) {
    setLocalSearch(v);
    setSelected(null);
  }

  function handleSelect(entry: CompareEntry) {
    setSelected(prev => prev?.pairId === entry.pairId ? null : { pairId: entry.pairId, entry });
  }

  return (
    <div>
      <SearchBar value={localSearch} onChange={handleSearch} />

      {isLoading ? (
        <div className="flex items-center justify-center py-28">
          <Spinner />
        </div>
      ) : pairs.length === 0 && !apiSearch ? (
        <EmptyState />
      ) : (
        <>
          {/* Comparison list */}
          <Panel className="shadow-ld-shadow-card">
            <div className="flex items-center gap-[9px] px-[20px] py-[16px] border-b border-ld-border">
              <GitCompareArrows className="w-[16px] h-[16px] text-ld-accent" />
              <b className="font-mono text-[12px] tracking-[.12em] uppercase text-ld-text-2 font-semibold">
                All Comparisons
              </b>
              <span className="ml-auto font-mono text-[12px] text-ld-text-3">
                {pairs.length} result{pairs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {pairs.length === 0 ? (
              <p className="py-[50px] px-[20px] text-center text-[14px] text-ld-text-3">
                No comparisons match that URL.
              </p>
            ) : (
              pairs.map(entry => (
                <CompareRow
                  key={entry.pairId}
                  entry={entry}
                  selected={selected?.pairId === entry.pairId}
                  onToggle={() => handleSelect(entry)}
                />
              ))
            )}
          </Panel>

          {/* Pair detail */}
          <AnimatePresence>
            {selected && (
              <motion.div
                key={selected.pairId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.22 }}
              >
                <PairDetail pairId={selected.pairId} entry={selected.entry} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
