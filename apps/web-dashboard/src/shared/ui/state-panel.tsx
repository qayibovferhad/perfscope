import { AlertTriangle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

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
  const shownIcon = icon ?? (isError ? <AlertTriangle className={compact ? 'w-4 h-4' : 'w-7 h-7'} /> : null);

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

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-[16px] px-[22px] py-[52px]',
        'border border-ld-border bg-ld-surface',
        className,
      )}
    >
      {shownIcon && (
        <div
          className={cn(
            'w-14 h-14 rounded-[16px] grid place-items-center mb-4 border',
            // --ld-rose is a different hue per theme, so the tint has to come from tokens
            // rather than a hardcoded rgba — hence a bordered tile instead of a wash.
            isError
              ? 'border-ld-border bg-ld-surface-2 text-ld-rose'
              : 'border-ld-accent-line bg-ld-accent-soft text-ld-accent',
          )}
        >
          {shownIcon}
        </div>
      )}

      <p className={cn('text-sm font-semibold mb-1', isError ? 'text-ld-rose' : 'text-ld-text')}>
        {title}
      </p>

      {description && (
        <p className="text-xs text-ld-text-3 max-w-[42ch] leading-relaxed">{description}</p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
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
              <button
                onClick={onRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[11px] text-sm font-semibold
                           border border-ld-border-strong bg-ld-surface text-ld-text
                           hover:border-ld-accent-line disabled:opacity-50"
              >
                {isRetrying ? 'Retrying…' : 'Try again'}
              </button>
            ),
          }
        : {})}
    />
  );
}
