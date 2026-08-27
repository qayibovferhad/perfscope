import { cn } from '@/shared/lib/utils';

interface PanelHeaderProps {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Icon, title, and whatever the panel wants to say about itself.
 *
 * The row wraps rather than compressing. On one line at 390px, "Resource Dependency Chain"
 * was breaking into three stacked words while its meta broke into three beside it and the
 * chip after them was cut off by the panel edge — three columns of shredded text where
 * two stacked lines would have read perfectly. The title now refuses to break
 * (`whitespace-nowrap` is wrong for long titles, so it is `min-w-0` plus a basis that
 * pushes the rest onto its own line).
 */
export function PanelHeader({ icon, title, meta, children, className }: PanelHeaderProps) {
  return (
    <div className={cn('flex items-center gap-x-[10px] gap-y-[6px] flex-wrap px-[18px] py-[14px] border-b border-ld-border', className)}>
      <span className="w-[32px] h-[32px] rounded-[9px] grid place-items-center bg-ld-accent-soft border border-ld-accent-line [&_svg]:w-[15px] [&_svg]:h-[15px] [&_svg]:text-[var(--ld-accent)] shrink-0">
        {icon}
      </span>
      {/* A heading, not a span: this is the name of the block below it, and a report is
          two dozen panels deep — without headings a screen reader has no way to move
          between them. `h2` everywhere rather than a per-call level, because the pages
          that hold panels all put an `h1` at the top and nothing in between; a level a
          caller can choose is a level that drifts. */}
      <h2 className="text-[14px] font-bold text-ld-text tracking-tight flex-1 min-w-[140px]">{title}</h2>
      {meta && (
        <span className="font-mono text-[11px] text-ld-text-3 tabular-nums">{meta}</span>
      )}
      {children}
    </div>
  );
}
