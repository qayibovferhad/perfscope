import { AlertTriangle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Dial, InstrumentField } from '@/shared/ui/instrument';

export type StatePanelVariant = 'empty' | 'error';

interface Props {
  /** Defaults to a warning triangle on the error variant. */
  icon?:        React.ReactNode;
  title:        string;
  description?: React.ReactNode;
  /** Usually a Button — "Add Website", "Try again", "Go to Analyzer". */
  action?:      React.ReactNode;
  variant?:     StatePanelVariant;
  /** In-card one-liner: a single compact row instead of the full-height panel. */
  compact?:     boolean;
  className?:   string;
}

/**
 * The screen a list shows when it has nothing to show.
 *
 * Shared rather than owned by a page because the distinction it encodes is easy to get
 * wrong in isolation: a request that *failed* and a request that legitimately returned
 * nothing are different states, and every page that collapses them into one empty state
 * tells the user "you have no websites" when the truth is "we could not reach the server".
 * Giving both a single component makes the error variant the path of least resistance.
 */
export function StatePanel({
  icon, title, description, action, variant = 'empty', compact = false, className,
}: Props) {
  const isError = variant === 'error';
  const shownIcon = icon ?? (isError ? <AlertTriangle className={compact ? 'w-4 h-4' : 'w-6 h-6'} /> : null);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-[10px] px-[4px] py-[10px]', className)}>
        {shownIcon && (
          <span className={cn('shrink-0', isError ? 'text-ld-rose' : 'text-ld-text-3')}>
            {shownIcon}
          </span>
        )}
        <span className={cn('text-[12.5px]', isError ? 'text-ld-rose' : 'text-ld-text-3')}>
          {title}{description ? <> — {description}</> : null}
        </span>
        {action && <span className="ml-auto shrink-0">{action}</span>}
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  // Unchanged, and deliberately: an error is centred, tight and urgent. The empty state
  // below is the opposite kind of screen — it is where somebody *starts*, and it used to
  // be a small centred box adrift in a page of nothing, which is the single most
  // template-looking screen in the product.
  if (isError) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center text-center rounded-[16px] px-[22px] py-[38px]',
          'border border-ld-border bg-ld-surface',
          className,
        )}
      >
        {shownIcon && (
          <div className="w-12 h-12 rounded-[14px] grid place-items-center mb-[14px] border border-ld-border bg-ld-surface-2 text-ld-rose">
            {shownIcon}
          </div>
        )}
        <p className="text-[15px] font-semibold mb-[5px] text-ld-rose">{title}</p>
        {description && (
          <p className="text-[13px] text-ld-text-2 max-w-[46ch] leading-relaxed">{description}</p>
        )}
        {action && <div className="mt-[18px]">{action}</div>}
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  // An instrument with nothing on it yet: the page's own field, and a dial whose needle
  // has never moved. The caller's icon sits inside the dial rather than in a tile, so the
  // blank state is recognisably the same object that will hold the reading later.
  return (
    <InstrumentField className={cn('px-[30px] py-[34px] max-sm:px-[20px]', className)}>
      <div className="flex items-center gap-[28px] max-sm:flex-col max-sm:text-center max-sm:gap-[18px]">
        {/* `md`, not `lg`: half these panels sit in a page's narrow column, and a 116px
            dial there left the sentence beside it breaking every four words. */}
        <Dial value={null} size="md" tone="neutral" decorative glyph={shownIcon} />

        <div className="min-w-0">
          <p className="text-[17px] font-bold tracking-[-0.01em] text-ld-text">{title}</p>
          {description && (
            <p className="text-[13.5px] text-ld-text-2 max-w-[54ch] leading-relaxed mt-[7px]">
              {description}
            </p>
          )}
          {action && <div className="mt-[18px] flex max-sm:justify-center">{action}</div>}
        </div>
      </div>
    </InstrumentField>
  );
}

/**
 * The error variant every list reaches for. Kept as its own export so the copy — and the
 * fact that there is a retry at all — stays consistent across pages.
 */
export function QueryErrorPanel({
  what, onRetry, isRetrying = false, className,
}: {
  /** What could not be loaded, lowercase: "your websites", "audit history". */
  what:        string;
  onRetry?:    () => void;
  isRetrying?: boolean;
  className?:  string;
}) {
  return (
    <StatePanel
      variant="error"
      title={`Could not load ${what}`}
      description="The server did not respond. It may be restarting — this keeps trying, and the page fills in on its own once it answers."
      className={className}
      {...(onRetry
        ? {
            action: (
              <Button variant="outline" onClick={onRetry} disabled={isRetrying}>
                {isRetrying ? 'Retrying…' : 'Try again'}
              </Button>
            ),
          }
        : {})}
    />
  );
}
