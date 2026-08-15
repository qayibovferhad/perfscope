import { cn } from '@/shared/lib/utils';

/**
 * The page column, and the block at the top of it.
 *
 * Every page used to declare its own width and padding, and nine pages had five different
 * answers — 1180px, 1080px, 1020px, 820px, 720px, `max-w-6xl` — with the top padding
 * drifting alongside them. Navigating between them moved the left edge of the content and
 * the height of the first line, which is most of why the app did not feel like one product.
 *
 * Three named widths, not free numbers. A page picking `wide` because it holds two audits
 * side by side is a decision; a page at 1020px because that is what it was written with is
 * not, and there is nowhere here to express the second.
 */

const WIDTHS = {
  /** Lists, dashboards, reports — nearly everything. */
  default: 'w-[min(1180px,100%)]',
  /** Two audits side by side, where the columns need the room. */
  wide:    'w-[min(1400px,100%)]',
  /**
   * Forms and prose, where a full-width line is too long to read comfortably.
   *
   * The *column* stays the default width and only its contents are capped, so the page
   * title and the first field keep the same left edge as every other page. Centring the
   * whole thing reads fine in isolation but shifts the content sideways the moment you
   * navigate to it, which is the problem this file exists to remove.
   */
  narrow:  'w-[min(1180px,100%)]',
} as const;

/** Applied to the children, not the column — see `narrow` above. */
const INNER = {
  default: '',
  wide:    '',
  narrow:  'max-w-[760px]',
} as const;

interface PageProps {
  children: React.ReactNode;
  width?: keyof typeof WIDTHS;
  className?: string;
}

export function Page({ children, width = 'default', className }: PageProps) {
  return (
    <div className={cn(
      WIDTHS[width],
      // Padding scales with the viewport rather than stepping at a breakpoint, so the
      // column keeps its margins on a laptop without wasting half the screen on a monitor.
      'mx-auto px-[clamp(22px,4vw,48px)] pt-[34px] pb-20',
      className,
    )}>
      {INNER[width] ? <div className={INNER[width]}>{children}</div> : children}
    </div>
  );
}

interface PageHeaderProps {
  /** Small uppercase label above the title. Usually the section, not a repeat of the title. */
  eyebrow?: string;
  title: React.ReactNode;
  /** One line on what the page is for. */
  description?: React.ReactNode;
  /** Primary action(s), pinned to the right and baseline-aligned with the title block. */
  actions?: React.ReactNode;
  /** Counts, badges or filters that belong to the page rather than to any section in it. */
  meta?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, meta, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-[28px]', className)}>
      <div className="flex items-end justify-between gap-5 flex-wrap">
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-mono text-[12px] tracking-[.16em] uppercase text-ld-accent font-semibold">
              {eyebrow}
            </p>
          )}
          <h1 className={cn(
            'text-[clamp(26px,3.4vw,34px)] font-extrabold tracking-[-0.03em] text-ld-text',
            eyebrow && 'mt-2',
          )}>
            {title}
          </h1>
          {description && (
            <p className="text-[14.5px] text-ld-text-2 mt-[6px] max-w-[68ch]">{description}</p>
          )}
        </div>

        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {meta && <div className="flex items-center gap-2 flex-wrap mt-4">{meta}</div>}
    </header>
  );
}
