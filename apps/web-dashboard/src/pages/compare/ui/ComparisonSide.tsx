import { motion } from 'framer-motion';
import { Clock, Shield, Gauge, Eye, Code2, Search } from 'lucide-react';
import {
  scoreBand, vitalBand, GlossaryTip,
  type AnalysisResult, type ScoreBand, type VitalKey, type GlossaryKey,
} from '@/entities/analysis';
import { fmtSec, fmtCls } from '@/shared/lib/format';

// ─── Constants ────────────────────────────────────────────────────────────────

const CIRC = 2 * Math.PI * 33; // ≈ 207.3

// ─── Score band styling ───────────────────────────────────────────────────────

const RING_STROKE: Record<ScoreBand, string> = {
  good: 'stroke-ld-accent',
  warn: 'stroke-ld-amber',
  poor: 'stroke-ld-rose',
};
const NUM_CLASS: Record<ScoreBand, string> = {
  good: 'text-ld-accent-2',
  warn: 'text-ld-amber',
  poor: 'text-ld-rose',
};
const BAND_LABEL: Record<ScoreBand, string> = {
  good: 'Good',
  warn: 'Needs improvement',
  poor: 'Poor',
};

// ─── Score card ───────────────────────────────────────────────────────────────

// `term` is the glossary slug, which differs from the result key for best practices.
const SCORE_ITEMS = [
  { key: 'performance'   as const, term: 'performance'    as const, label: 'Performance',    Icon: Gauge  },
  { key: 'accessibility'  as const, term: 'accessibility'  as const, label: 'Accessibility',  Icon: Eye    },
  { key: 'bestPractices'  as const, term: 'best-practices' as const, label: 'Best Practices', Icon: Code2  },
  { key: 'seo'            as const, term: 'seo'            as const, label: 'SEO',            Icon: Search },
] as const;

function ScoreCard({
  label, term, Icon, score, delay = 0,
}: {
  label: string; term: GlossaryKey; Icon: React.ElementType; score: number; delay?: number;
}) {
  const band = scoreBand(score);
  const offset = CIRC * (1 - score / 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay }}
      className="rounded-[14px] border border-ld-border bg-ld-surface-2 p-[18px] text-center transition-all duration-200 hover:-translate-y-[2px] hover:border-ld-accent-line"
    >
      {/* Ring */}
      <div className="relative w-[76px] h-[76px] mx-auto mb-[11px]">
        <svg viewBox="0 0 76 76" className="w-[76px] h-[76px] -rotate-90">
          <circle cx="38" cy="38" r="33" fill="none" strokeWidth="7" className="stroke-ld-border" />
          <motion.circle
            cx="38" cy="38" r="33" fill="none" strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            initial={{ strokeDashoffset: CIRC }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: delay + 0.05 }}
            className={RING_STROKE[band]}
          />
        </svg>
        <span className={`absolute inset-0 grid place-items-center font-mono text-[22px] font-semibold ${NUM_CLASS[band]}`}>
          {score}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-[13.5px] font-semibold flex items-center justify-center gap-[6px]">
        <Icon className="w-[14px] h-[14px] text-ld-text-3" />
        <span className="text-ld-text">{label}</span>
        <GlossaryTip term={term} />
      </h4>

      {/* Status */}
      <p className="text-[11.5px] text-ld-text-3 mt-[3px]">{BAND_LABEL[band]}</p>
    </motion.div>
  );
}

// ─── Core Web Vitals styling ──────────────────────────────────────────────────

const VITAL_VAL_CLASS: Record<ScoreBand, string> = {
  good: 'text-ld-accent-2',
  warn: 'text-ld-amber',
  poor: 'text-ld-rose',
};
const VITAL_ST_CLASS: Record<ScoreBand, string> = {
  good: 'text-ld-accent',
  warn: 'text-ld-amber',
  poor: 'text-ld-rose',
};
const VITAL_ST_LABEL: Record<ScoreBand, string> = {
  good: 'Good',
  warn: 'Needs work',
  poor: 'Poor',
};

function fmtRaw(v: number) { return `${Math.round(v)}ms`; }

const METRICS = [
  { key: 'fcp' as const, abbr: 'FCP', fmt: fmtSec },
  { key: 'lcp' as const, abbr: 'LCP', fmt: fmtSec },
  { key: 'tbt' as const, abbr: 'TBT', fmt: fmtRaw },
  { key: 'cls' as const, abbr: 'CLS', fmt: fmtCls },
  { key: 'si'  as const, abbr: 'SI',  fmt: fmtSec },
  { key: 'tti' as const, abbr: 'TTI', fmt: fmtSec },
] as const;

function VitalsCell({ abbr, metricKey, value }: { abbr: string; metricKey: VitalKey; value: number }) {
  const band = vitalBand(metricKey, value);
  const { fmt } = METRICS.find(m => m.key === metricKey)!;

  return (
    <div className="px-[14px] py-[13px] rounded-[12px] border border-ld-border bg-ld-surface-2">
      <div className="font-mono text-[10px] tracking-[.08em] uppercase text-ld-text-3 flex items-center gap-[5px]">
        {abbr}
        <GlossaryTip term={metricKey} />
      </div>
      <div className={`font-mono text-[18px] font-semibold mt-[6px] ${VITAL_VAL_CLASS[band]}`}>
        {fmt(value)}
      </div>
      <div className={`text-[10px] font-semibold mt-[2px] ${VITAL_ST_CLASS[band]}`}>
        {VITAL_ST_LABEL[band]}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHead({ icon, title, right }: {
  icon: React.ReactNode; title: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-[11px] mb-[22px]">
      <div className="w-8 h-8 rounded-[9px] grid place-items-center bg-ld-surface-2 border border-ld-border text-ld-accent shrink-0">
        {icon}
      </div>
      <h2 className="text-[16px] font-bold tracking-[-0.01em] text-ld-text">{title}</h2>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

function ColHead({ isYou }: { isYou: boolean }) {
  return (
    <div className={`flex items-center gap-[9px] font-mono text-[12px] font-semibold tracking-[.1em] uppercase mb-[14px] ${isYou ? 'text-ld-accent-2' : 'text-ld-amber'}`}>
      <span className={`w-[9px] h-[9px] rounded-full shrink-0 ${isYou ? 'bg-ld-accent' : 'bg-ld-amber'}`} />
      {isYou ? 'Your Site' : 'Competitor'}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex gap-[14px]">
      <span className="inline-flex items-center gap-[6px] font-mono text-[11px] text-ld-text-3">
        <span className="w-[9px] h-[9px] rounded-full bg-ld-accent shrink-0" />
        Your Site
      </span>
      <span className="inline-flex items-center gap-[6px] font-mono text-[11px] text-ld-text-3">
        <span className="w-[9px] h-[9px] rounded-full bg-ld-amber shrink-0" />
        Competitor
      </span>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ComparisonSide({
  target, competitor,
}: {
  target: AnalysisResult; competitor: AnalysisResult;
}) {
  return (
    <div className="space-y-[18px]">

      {/* ── Category Scores ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="rounded-[20px] border border-ld-border bg-ld-surface shadow-ld-shadow-card p-[26px]"
      >
        <SectionHead
          icon={<Clock className="w-[16px] h-[16px]" />}
          title="Category Scores"
          right={<Legend />}
        />

        <div className="grid grid-cols-2 gap-[24px] max-[760px]:grid-cols-1">
          {/* You column */}
          <div>
            <ColHead isYou />
            <div className="grid grid-cols-2 gap-[12px]">
              {SCORE_ITEMS.map(({ key, term, label, Icon }, i) => (
                <ScoreCard
                  key={key}
                  label={label} term={term} Icon={Icon}
                  score={target.scores[key]}
                  delay={i * 0.07}
                />
              ))}
            </div>
          </div>

          {/* Competitor column */}
          <div>
            <ColHead isYou={false} />
            <div className="grid grid-cols-2 gap-[12px]">
              {SCORE_ITEMS.map(({ key, term, label, Icon }, i) => (
                <ScoreCard
                  key={key}
                  label={label} term={term} Icon={Icon}
                  score={competitor.scores[key]}
                  delay={i * 0.07 + 0.1}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Core Web Vitals ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.08 }}
        className="rounded-[20px] border border-ld-border bg-ld-surface shadow-ld-shadow-card p-[26px]"
      >
        <SectionHead
          icon={<Shield className="w-[16px] h-[16px]" />}
          title="Core Web Vitals"
        />

        <div className="grid grid-cols-2 gap-[24px] max-[760px]:grid-cols-1">
          {/* You column */}
          <div>
            <ColHead isYou />
            <div className="grid grid-cols-3 gap-[10px]">
              {METRICS.map(({ key, abbr }) => (
                <VitalsCell key={key} abbr={abbr} metricKey={key} value={target.metrics[key]} />
              ))}
            </div>
          </div>

          {/* Competitor column */}
          <div>
            <ColHead isYou={false} />
            <div className="grid grid-cols-3 gap-[10px]">
              {METRICS.map(({ key, abbr }) => (
                <VitalsCell key={key} abbr={abbr} metricKey={key} value={competitor.metrics[key]} />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

    </div>
  );
}
