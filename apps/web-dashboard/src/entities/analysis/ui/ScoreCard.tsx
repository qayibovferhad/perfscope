import { motion } from 'framer-motion';
import { Gauge, Eye, Code2, Search } from 'lucide-react';
import { Skeleton } from '@/shared/ui/skeleton';
import { Dial } from '@/shared/ui/instrument';
import { cn } from '@/shared/lib/utils';
import { scoreBand, BAND_TEXT, BAND_LABEL } from '../lib';
import { GlossaryTip } from './GlossaryTip';
import { DeltaBadge } from './DeltaBadge';
import type { CategoryKey } from '../glossary';

const ICONS = {
  Performance:      Gauge,
  Accessibility:    Eye,
  'Best Practices': Code2,
  SEO:              Search,
} as const;

export type ScoreLabel = keyof typeof ICONS;

/** Display strings are what the audit hands us; the glossary is keyed by slug. */
const TERM: Record<ScoreLabel, CategoryKey> = {
  Performance:      'performance',
  Accessibility:    'accessibility',
  'Best Practices': 'best-practices',
  SEO:              'seo',
};

/**
 * The category's dial before its number arrives.
 *
 * A grey disc said "something will be here"; the dial with its needle sweeping says the
 * instrument is *running*, which is what is actually true — the run is in flight and this
 * category has not reported yet. It is also the same object the score lands in, so
 * nothing on the card is replaced when it does.
 */
export function ScoreCardSkeleton({ label }: { label: ScoreLabel }) {
  const Icon = ICONS[label];
  return (
    <div className="rounded-[16px] border border-ld-border bg-ld-surface p-[22px] text-center">
      <div className="w-[116px] mx-auto mb-[14px]">
        <Dial value={null} size="lg" tone="neutral" pending label={`${label} — still measuring`} />
      </div>
      <div className="flex items-center justify-center gap-[7px] mb-1">
        <Icon className="w-[15px] h-[15px] text-ld-text-3" />
        <span className="text-[15px] font-bold text-ld-text">{label}</span>
      </div>
      <Skeleton className="h-3 w-20 mx-auto mt-1 rounded" />
    </div>
  );
}

export function ScoreCard({ label, score, previous, since }: {
  label: ScoreLabel;
  score: number;
  /** The same category's score in the previous run, when there is one. */
  previous?: number | undefined;
  /** ISO timestamp of that run, for the badge's tooltip. */
  since?: string | undefined;
}) {
  const Icon = ICONS[label];
  const status = scoreBand(score);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="rounded-[16px] border border-ld-border bg-ld-surface p-[22px] text-center relative overflow-hidden transition-all duration-200 hover:-translate-y-[3px] hover:border-ld-accent-line"
    >
      {/* The reading. A 270° dial with a printed scale rather than a closed ring: the
          same instrument the dashboard and the websites list open with, so a score means
          the same thing wherever the product draws one. */}
      <div className="w-[116px] mx-auto mb-[14px]">
        <Dial
          value={score}
          size="lg"
          tone={status}
          label={`${label} score ${score} out of 100`}
        />
      </div>

      {/* Title */}
      <h3 className="flex items-center justify-center gap-[7px] text-[15px] font-bold text-ld-text">
        <Icon className={cn('w-[15px] h-[15px]', BAND_TEXT[status])} />
        {label}
        <GlossaryTip term={TERM[label]} />
      </h3>

      {/* Status, and how it moved */}
      <p className={cn('text-[12.5px] font-semibold mt-1 flex items-center justify-center gap-[8px]', BAND_TEXT[status])}>
        {BAND_LABEL[status]}
        <DeltaBadge kind="score" curr={score} prev={previous} since={since} />
      </p>
    </motion.div>
  );
}
