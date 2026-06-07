import { motion } from 'framer-motion';
import { Gauge, Eye, Code2, Search } from 'lucide-react';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

const ICONS = {
  Performance:      Gauge,
  Accessibility:    Eye,
  'Best Practices': Code2,
  SEO:              Search,
} as const;

export type ScoreLabel = keyof typeof ICONS;

type Status = 'good' | 'warn' | 'poor';

function getStatus(score: number): Status {
  if (score >= 90) return 'good';
  if (score >= 50) return 'warn';
  return 'poor';
}

const ARC_STROKE: Record<Status, string> = {
  good: '[stroke:var(--ld-accent)]',
  warn: '[stroke:var(--ld-amber)]',
  poor: '[stroke:var(--ld-rose)]',
};

const COLOR: Record<Status, string> = {
  good: 'text-[var(--ld-score-good)]',
  warn: 'text-[var(--ld-amber)]',
  poor: 'text-[var(--ld-rose)]',
};

const LABEL: Record<Status, string> = {
  good: 'Good',
  warn: 'Needs improvement',
  poor: 'Poor',
};

const DASH = 289; // 2π * 46

export function ScoreCardSkeleton({ label }: { label: ScoreLabel }) {
  const Icon = ICONS[label];
  return (
    <div className="rounded-[16px] border border-ld-border bg-ld-surface p-[22px] text-center">
      <Skeleton className="w-[104px] h-[104px] mx-auto mb-[14px] rounded-full" />
      <div className="flex items-center justify-center gap-[7px] mb-1">
        <Icon className="w-[15px] h-[15px] text-ld-text-3" />
        <span className="text-[15px] font-bold text-ld-text">{label}</span>
      </div>
      <Skeleton className="h-3 w-20 mx-auto mt-1 rounded" />
    </div>
  );
}

export function ScoreCard({ label, score }: { label: ScoreLabel; score: number }) {
  const Icon = ICONS[label];
  const status = getStatus(score);
  const offset = DASH * (1 - score / 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="rounded-[16px] border border-ld-border bg-ld-surface p-[22px] text-center relative overflow-hidden transition-all duration-200 hover:-translate-y-[3px] hover:border-ld-accent-line"
    >
      {/* Gauge ring */}
      <div className="relative w-[104px] h-[104px] mx-auto mb-[14px]">
        <svg viewBox="0 0 104 104" className="w-[104px] h-[104px] -rotate-90">
          <circle
            cx="52" cy="52" r="46"
            fill="none" strokeWidth="8"
            className="[stroke:var(--ld-border)]"
          />
          <motion.circle
            cx="52" cy="52" r="46"
            fill="none" strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={DASH}
            initial={{ strokeDashoffset: DASH }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
            className={ARC_STROKE[status]}
          />
        </svg>
        <span className={cn(
          'absolute inset-0 grid place-items-center font-mono text-[30px] font-semibold',
          COLOR[status],
        )}>
          {score}
        </span>
      </div>

      {/* Title */}
      <h3 className="flex items-center justify-center gap-[7px] text-[15px] font-bold text-ld-text">
        <Icon className={cn('w-[15px] h-[15px]', COLOR[status])} />
        {label}
      </h3>

      {/* Status */}
      <p className={cn('text-[12.5px] font-semibold mt-1', COLOR[status])}>
        {LABEL[status]}
      </p>
    </motion.div>
  );
}
