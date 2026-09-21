import { useLocation } from 'react-router-dom';
import { NAV } from '@/shared/config/nav';
import { Ruler } from '@/shared/ui/instrument';
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
  /**
   * Two mono digits printed before the eyebrow, like a channel on an instrument.
   * Derived from the sidebar's own order for the eleven routes that are in it; pass one
   * explicitly for a page that has no nav entry, or `null` to print none.
   */
  index?: string | null;
  className?: string;
}

/**
 * The route's position in the sidebar, as a two-digit channel number.
 *
 * It comes from `NAV` rather than from a second list so a reordered sidebar renumbers the
 * headers with it — a hand-kept table of "page 07" is a table that goes wrong silently.
 * Longest match wins: `/history/compare` is still History, and a route with no entry
 * (a project, a shared report) simply gets no number.
 */
function useRouteIndex(): string | null {
  const { pathname } = useLocation();
  let best = -1;
  let bestLen = 0;
  NAV.forEach((item, i) => {
    const hit = pathname === item.to || pathname.startsWith(`${item.to}/`);
    if (hit && item.to.length > bestLen) { best = i; bestLen = item.to.length; }
  });
  return best === -1 ? null : String(best + 1).padStart(2, '0');
}

export function PageHeader({
  eyebrow, title, description, actions, meta, index, className,
}: PageHeaderProps) {
  const routeIndex = useRouteIndex();
  // `undefined` means "use the route's own number"; `null` means "this page has none".
  const channel = index === undefined ? routeIndex : index;

  return (
    <header className={cn('mb-[28px]', className)}>
      <div className="flex items-start justify-between gap-5 flex-wrap">
        <div className="min-w-0 flex-1">
          {/* The instrument label: channel, a rule that runs out to the eyebrow, then the
              section. It replaced a bare accent-coloured word that every one of the
              twenty pages printed identically — same size, same colour, same position —
              which is most of what made them feel like one generated template. */}
          {(eyebrow || channel) && (
            <div className="flex items-center gap-[10px] min-w-0">
              {channel && (
                <span className="font-mono text-[12px] font-semibold text-ld-text-3 tabular-nums shrink-0">
                  {channel}
                </span>
              )}
              {/* The rule connects the channel to the section; with no section to reach
                  it is a dash hanging in space, which is what a page with no eyebrow drew. */}
              {eyebrow && <span aria-hidden className="h-px w-[clamp(18px,4vw,46px)] bg-ld-border-strong shrink-0" />}
              {eyebrow && (
                <p className="font-mono text-[11.5px] tracking-[.22em] uppercase text-ld-accent font-semibold truncate">
                  {eyebrow}
                </p>
              )}
            </div>
          )}

          <h1 className={cn(
            'text-[clamp(26px,3.4vw,34px)] font-extrabold tracking-[-0.03em] text-ld-text',
            (eyebrow || channel) && 'mt-[10px]',
          )}>
            {title}
          </h1>

          {/* The ruler sits under the title and above the description, so the sentence
              reads as a caption printed below a scale rather than as a second heading. */}
          <Ruler className="mt-[10px] max-w-[420px]" />

          {description && (
            <p className="text-[14.5px] text-ld-text-2 mt-[12px] max-w-[68ch]">{description}</p>
          )}
        </div>

        {/* Level with the title, not with the bottom of a block that now carries a
            ruler and a caption under it — `items-end` on the row dropped the primary
            action to the foot of the header, a button's height away from what it acts on. */}
        {actions && <div className="flex items-center gap-2 shrink-0 mt-[26px] max-sm:mt-0">{actions}</div>}
      </div>

      {meta && <div className="flex items-center gap-2 flex-wrap mt-4">{meta}</div>}
    </header>
  );
}
