import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/shared/lib/utils';

/**
 * The card every panel on the comparison page is drawn in, and its header.
 *
 * Seven panels hand-wrote the same shell — `rounded-[20px]`, border, surface, shadow,
 * 26px of padding — six of them inside an identical motion wrapper. Two of them had
 * already extracted a local `SectionHead`, one taking a `badge` and the other a `right`,
 * which is the same component reinvented twice in sibling files.
 *
 * It does not use shared `Panel`: that one is `rounded-[16px]` with no shadow and no
 * padding by design, because dashboard panels hold full-bleed tables and charts. These
 * are inset cards. Rather than add a third tone to a primitive used app-wide for one
 * page's look, the look lives with the page.
 */
/** The icon-tile + title row. Used on its own for sub-headings inside a section. */
export function SectionHead({ icon, title, badge, right }: {
  icon: ReactNode;
  /** Small accent pill after the title — "Network", "Efficiency score". */
  badge?: string;
  title: string;
  /** Anything right-aligned, e.g. a legend. */
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-[11px] mb-[22px]">
      <div className="w-8 h-8 rounded-[9px] grid place-items-center bg-ld-surface-2 border border-ld-border text-ld-accent shrink-0 [&_svg]:w-[16px] [&_svg]:h-[16px]">
        {icon}
      </div>
      <h2 className="text-[16px] font-bold tracking-[-0.01em] text-ld-text">{title}</h2>
      {badge && (
        <span className="font-mono text-[10.5px] font-semibold px-[9px] py-[4px] rounded-[6px] border border-ld-accent-line bg-ld-accent-soft text-ld-accent-2">
          {badge}
        </span>
      )}
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

export function CompareSection({
  icon, title, badge, right, children, delay, animate = true, className,
}: {
  icon: ReactNode;
  title: string;
  badge?: string;
  right?: ReactNode;
  children: ReactNode;
  /** Stagger against a sibling section. */
  delay?: number;
  /** The scoreboard sits above the fold and appears without a fade — it always did. */
  animate?: boolean;
  className?: string;
}) {
  const shell = cn(
    'rounded-[20px] border border-ld-border bg-ld-surface shadow-ld-shadow-card p-[26px]',
    className,
  );

  const head = <SectionHead icon={icon} title={title} badge={badge} right={right} />;

  if (!animate) {
    return <div className={shell}>{head}{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', ...(delay !== undefined ? { delay } : {}) }}
      className={shell}
    >
      {head}
      {children}
    </motion.div>
  );
}
