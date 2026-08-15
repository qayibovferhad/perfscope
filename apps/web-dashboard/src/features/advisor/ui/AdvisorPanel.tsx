import { useLocation } from 'react-router-dom';
import { Sparkles, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { useAdvice } from '../model/useAdvice';
import { useAdvisorStore } from '../model/advisorStore';

/**
 * The advisor, present on every page of the dashboard.
 *
 * The rest of the AI in this product comments on a thing you asked for — an audit, a
 * comparison, an alert. This is the half that was missing: something that looks at where
 * you are and says what to do next, without being asked.
 *
 * It takes its own column rather than floating over the page — but only where that is
 * free. `<Page>` caps content at 1180px, so on a 1536px+ screen the panel sits in space
 * the layout was not using anyway; below that it would have taken 300px off a laptop
 * (measured: a 1280px window went from a 993px content column to 692px), so there it
 * overlays instead and the page keeps its width.
 */
export function AdvisorPanel() {
  const { open, toggle } = useAdvisorStore();
  const { pathname } = useLocation();

  // Routes about one page get advice about that page. Everything else is account-wide —
  // two scopes rather than one per route, because the advice a user needs on the websites
  // list is the same advice they need on the dashboard.
  const { data: advice, isPending, isFetching, refetch } = useAdvice('overview');

  // Nothing to show and nothing coming: no key configured, or the model had nothing to
  // say. Take the whole column back rather than leaving an empty frame.
  if (!isPending && !advice) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="Show advisor"
        className="shrink-0 w-[46px] border-l border-ld-border bg-ld-surface hover:bg-ld-surface-hover
                   flex flex-col items-center gap-3 pt-4 transition-colors max-md:hidden"
      >
        <Sparkles className="w-[18px] h-[18px] text-ld-accent" />
        <span className="text-[11px] font-semibold tracking-[.14em] uppercase text-ld-text-3 [writing-mode:vertical-rl]">
          Advisor
        </span>
      </button>
    );
  }

  return (
    <aside
      className={cn(
        'flex w-[300px] flex-col border-l border-ld-border bg-ld-surface overflow-y-auto',
        // Part of the layout where there is room for it…
        '2xl:relative 2xl:shrink-0',
        // …and over the page where there is not. Hidden entirely on a phone, where three
        // columns do not fit and this is not what anyone came for.
        'max-2xl:fixed max-2xl:right-0 max-2xl:top-0 max-2xl:bottom-0 max-2xl:z-40 max-2xl:shadow-2xl',
        'max-md:hidden',
      )}
      aria-label="Advisor"
    >
      <header className="flex items-center gap-2 px-4 py-[14px] border-b border-ld-border sticky top-0 bg-ld-surface">
        <Sparkles className="w-4 h-4 text-ld-accent shrink-0" />
        <span className="text-[13px] font-semibold text-ld-text">Advisor</span>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Ask again"
          className="ml-auto"
        >
          <RefreshCw className={cn('w-[14px] h-[14px]', isFetching && 'animate-spin')} />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Hide advisor">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </header>

      <div className="p-4">
        {isPending ? <AdviceSkeleton /> : advice ? (
          <>
            <p className="text-[14px] font-semibold leading-snug text-ld-text">{advice.headline}</p>

            {advice.steps.length > 0 && (
              <ol className="mt-4 space-y-3">
                {advice.steps.map((step, i) => (
                  <li key={i} className="relative pl-[26px]">
                    <span className="absolute left-0 top-[1px] w-[18px] h-[18px] rounded-full grid place-items-center
                                     text-[10px] font-bold font-mono
                                     border border-ld-accent-line bg-ld-accent-soft text-ld-accent">
                      {i + 1}
                    </span>
                    <p className="text-[12.5px] font-semibold text-ld-text leading-snug">{step.title}</p>
                    <p className="text-[12px] text-ld-text-2 leading-relaxed mt-[2px]">{step.detail}</p>
                  </li>
                ))}
              </ol>
            )}

            <p className="mt-5 pt-3 border-t border-ld-border text-[11px] text-ld-text-3">
              From your own audits, by Gemini. {pathname === '/dashboard' ? 'Across every site.' : 'Account-wide.'}
            </p>
          </>
        ) : null}
      </div>
    </aside>
  );
}

function AdviceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/5" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="pl-[26px] space-y-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
