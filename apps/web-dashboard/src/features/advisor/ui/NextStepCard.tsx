import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/shared/ui/skeleton';
import { useAdvice } from '../model/useAdvice';

/**
 * The advisor's headline, at the top of the dashboard.
 *
 * The panel is always there but easy to stop seeing; this is the same advice given the
 * position it deserves on the one page everybody lands on. Deliberately only the headline
 * and the first step — the panel beside it has the rest, and repeating all three here would
 * make the dashboard's most prominent element the longest thing on it.
 */
export function NextStepCard() {
  const { data: advice, isPending } = useAdvice('overview');

  if (!isPending && !advice) return null;

  const first = advice?.steps[0];

  return (
    <section className="rounded-[16px] border border-ld-accent-line bg-ld-accent-soft px-5 py-[18px] mb-[22px]">
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-[10px] grid place-items-center shrink-0
                         border border-ld-accent-line bg-ld-surface text-ld-accent">
          <Sparkles className="w-[17px] h-[17px]" />
        </span>

        <div className="min-w-0 flex-1">
          {isPending ? (
            <div className="space-y-2 py-[3px]">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ) : (
            <>
              <p className="text-[15px] font-semibold text-ld-text leading-snug">{advice!.headline}</p>
              {first && (
                <p className="text-[13px] text-ld-text-2 mt-1 leading-relaxed">
                  <b className="font-semibold text-ld-text">{first.title}</b> — {first.detail}
                </p>
              )}
            </>
          )}
        </div>

        {!isPending && (advice?.steps.length ?? 0) > 1 && (
          <Link
            to="/websites"
            className="hidden sm:inline-flex items-center gap-1.5 shrink-0 text-[12.5px] font-semibold
                       text-ld-accent hover:underline"
          >
            {advice!.steps.length - 1} more
            <ArrowRight className="w-[14px] h-[14px]" />
          </Link>
        )}
      </div>
    </section>
  );
}
