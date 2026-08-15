import { Sparkles } from 'lucide-react';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

/**
 * Every piece of Gemini commentary in the app renders through one of these two.
 *
 * They share a rule that matters more than their looks: **nothing is ever a placeholder for
 * missing AI.** While a live audit is waiting for `analysis:insights` they show a skeleton;
 * once that event lands they show what came back, or disappear. A deployment with no
 * `GEMINI_API_KEY` gets an instant empty payload, so the skeleton never meaningfully
 * appears and no "AI unavailable" text is ever written — the feature is simply absent.
 *
 * They are also the reason the AI reads as one layer rather than four features: the same
 * accent, the same sparkle, the same voice, whether it is commenting on a whole page or a
 * single audit row.
 */

/** The accent shared by every AI surface, so the layer is recognisable at a glance. */
const AI_ICON = 'text-ld-accent shrink-0';

interface AiCardProps {
  /** Heading. Defaults to the analyzer's original label. */
  title?: string;
  /** What Gemini said. Undefined or empty renders nothing (unless `pending`). */
  text?: string;
  /** The audit is done but the commentary is still being written. */
  pending?: boolean;
  className?: string;
}

/** A titled block of commentary — for a page, a waterfall, a comparison. */
export function AiCard({ title = 'AI Insights', text, pending, className }: AiCardProps) {
  if (!pending && !text) return null;

  return (
    <div className={cn('rounded-xl border border-ld-accent-line bg-ld-surface p-5', className)}>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className={cn('h-4 w-4', AI_ICON)} />
        <h3 className="text-sm font-semibold text-ld-text">{title}</h3>
        <span className="ml-auto text-xs text-ld-text-3">Powered by Gemini</span>
      </div>

      {pending
        ? <PendingLines count={3} />
        : <div className="whitespace-pre-line text-sm leading-relaxed text-ld-text-2">{text}</div>}
    </div>
  );
}

interface AiNoteProps {
  text?: string;
  pending?: boolean;
  className?: string;
}

/**
 * One line of commentary sitting inside something else — an audit row, a metric tile.
 *
 * Deliberately quieter than `AiCard`: on a report with a dozen failing audits these repeat
 * a dozen times, and a dozen bordered cards would bury the audit list they are annotating.
 */
export function AiNote({ text, pending, className }: AiNoteProps) {
  if (!pending && !text) return null;

  return (
    <div className={cn('flex items-start gap-1.5 text-xs leading-relaxed text-ld-text-2', className)}>
      <Sparkles className={cn('mt-0.5 h-3 w-3', AI_ICON)} />
      {pending
        ? <Skeleton className="h-3 w-3/4 self-center" />
        : <span>{text}</span>}
    </div>
  );
}

function PendingLines({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        // Last line short, the way a paragraph ends — a stack of equal bars reads as a
        // table loading, not a sentence being written.
        <Skeleton key={i} className={cn('h-3', i === count - 1 ? 'w-2/5' : 'w-full')} />
      ))}
    </div>
  );
}
