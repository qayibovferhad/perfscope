import { Sparkles, ChevronRight, RefreshCw, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { useAdvice } from '../model/useAdvice';
import { useAdvisorStore } from '../model/advisorStore';
import { actionLink } from '../lib/actionLink';
import { recordAdviceAction } from '../api/recordAction';

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
  const { open, toggle, context } = useAdvisorStore();

  // The subject comes from whichever page is mounted (see `useAdviceContext`), not from
  // matching the route here — the panel has no business knowing the route table.
  const { data: advice, isPending, isFetching, refetch } =
    useAdvice(context ? 'site' : 'overview', context?.url);

  // Nothing to show and nothing coming: no key configured, or the model had nothing to
  // say. Take the whole column back rather than leaving an empty frame.
  if (!isPending && !advice) return null;

  // Both states stay mounted, cross-fading inside a width-animated shell — swapping
  // <button> for <aside> outright (the old code) is an instant DOM replacement with
  // nothing for a browser to animate between. The 300px content never resizes; only the
  // clipping width does, so nothing inside reflows or squishes mid-transition.
  return (
    <motion.aside
      initial={false}
      animate={{ width: open ? 300 : 46 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        // `relative` unconditionally: the rail and the panel below are both absolutely
        // positioned against this element at every breakpoint, not just where the panel
        // sits in normal flow.
        'relative shrink-0 border-l border-ld-border bg-ld-surface overflow-hidden',
        // In flow where there is room for the column…
        // …and over the page where there is not. Hidden entirely on a phone, where three
        // columns do not fit and this is not what anyone came for.
        'max-2xl:fixed max-2xl:right-0 max-2xl:top-0 max-2xl:bottom-0 max-2xl:z-40 max-2xl:shadow-2xl',
        'max-md:hidden',
      )}
      aria-label="Advisor"
    >
      {/* Collapsed rail */}
      <motion.button
        type="button"
        onClick={toggle}
        aria-label="Show advisor"
        animate={{ opacity: open ? 0 : 1 }}
        transition={{ duration: open ? 0.1 : 0.2, delay: open ? 0 : 0.18 }}
        // Both buttons stay mounted throughout the cross-fade (see the comment above) —
        // `inert` on whichever one is currently invisible keeps it out of tab order,
        // click-through, and screen readers, not just out of the mouse's way.
        inert={open}
        className="absolute inset-y-0 left-0 w-[46px] hover:bg-ld-surface-hover
                   flex flex-col items-center gap-3 pt-4 transition-colors"
      >
        <Sparkles className="w-[18px] h-[18px] text-ld-accent" />
        <span className="text-[11px] font-semibold tracking-[.14em] uppercase text-ld-text-3 [writing-mode:vertical-rl]">
          Advisor
        </span>
      </motion.button>

      {/* Expanded panel */}
      <motion.div
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: open ? 0.22 : 0.1, delay: open ? 0.14 : 0 }}
        inert={!open}
        className="absolute inset-y-0 left-0 w-[300px] flex flex-col overflow-y-auto"
      >
        <header className="flex items-center gap-2 px-4 py-[14px] border-b border-ld-border sticky top-0 bg-ld-surface">
          <Sparkles className="w-4 h-4 text-ld-accent shrink-0" />
          <span className="text-[13px] font-semibold text-ld-text truncate">
            {context ? context.label : 'Advisor'}
          </span>

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
                      {/* Advice you can act on where you are reading it. Only present when
                          the step maps to something this app does — most fixes happen in
                          the user's own codebase, and a link there would be a lie. */}
                      {step.action && (
                        <Link
                          to={actionLink(step.action).to}
                          onClick={() => recordAdviceAction(step.action!)}
                          className="inline-flex items-center gap-1 mt-[6px] text-[12px] font-semibold
                                     text-ld-accent hover:underline"
                        >
                          {actionLink(step.action).label}
                          <ArrowRight className="w-[13px] h-[13px]" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              <p className="mt-5 pt-3 border-t border-ld-border text-[11px] text-ld-text-3">
                From your own audits, by Gemini.{' '}
                {context ? `About ${context.label}.` : 'Across every site you track.'}
              </p>
            </>
          ) : null}
        </div>
      </motion.div>
    </motion.aside>
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
