import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { useAskQuestion } from '../model/useAskQuestion';

/** One thing this widget can be asked about — its own `History` row. */
export interface AskSubject {
  key: string;
  label: string;
  analysisId: string;
}

interface Props {
  /**
   * 1 subject (the analyzer's own usage): plain "Ask about this audit" header, no switcher.
   * 2 subjects (compare's usage — target + competitor): a small tab strip picks which
   * page's evidence the question is answered against. Each subject keeps its own log and
   * its own five-question budget, since each is answered by a separate `History` row.
   */
  subjects: AskSubject[];
}

interface Exchange {
  question: string;
  answer:   string;
}

const MAX_QUESTIONS = 5;
const QUESTION_LIMIT = 500;

/**
 * A floating button, bottom-right of the viewport — the analyzer's monologue, made
 * answerable. Click opens a small popup; the answer is built from exactly the evidence
 * `analysePage` saw, nothing more, so it cannot say something the diagnosis on the page
 * would disagree with.
 *
 * Looks like a chat widget but is not one: each question is answered independently (no
 * conversation sent back to the model — see PLAN.md §4b), and five per audit
 * (server-enforced) keeps the cost of "just ask" bounded. The exchanges shown here are
 * local display state only, kept so the popup reads as a running conversation while it's
 * open, not proof of a stored thread.
 *
 * Portalled to `document.body`, the same fix `InfoTip` uses and for the same reason: a
 * `fixed` element inside a transformed or `overflow-hidden` ancestor gets clipped or
 * mispositioned, and the analyzer's result cards are exactly that kind of ancestor.
 */
export function AskAboutAudit({ subjects }: Props) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [activeKey, setActiveKey] = useState(subjects[0]?.key);
  const [exchanges, setExchanges] = useState<Record<string, Exchange[]>>({});
  const [remaining, setRemaining] = useState<Record<string, number>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const active = subjects.find((s) => s.key === activeKey) ?? subjects[0];
  const ask = useAskQuestion(active?.analysisId ?? '');
  const activeExchanges = active ? (exchanges[active.key] ?? []) : [];
  const activeRemaining = active ? (remaining[active.key] ?? MAX_QUESTIONS) : MAX_QUESTIONS;

  const outOfQuestions = activeRemaining <= 0;
  const disabled = outOfQuestions || ask.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || disabled || !active) return;

    const key = active.key;
    ask.mutate(q, {
      onSuccess: (data) => {
        setExchanges((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), { question: q, answer: data.answer }] }));
        setRemaining((prev) => ({ ...prev, [key]: data.questionsRemaining }));
        setQuestion('');
      },
    });
  }

  // Close on Escape or a click outside — the same pattern InfoTip uses.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onPointerDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  // New exchange arrives below the fold of a growing log — keep it in view. Keyed on the
  // count, not the array: `activeExchanges` is rebuilt every render, so depending on it
  // scrolled the log on every render rather than when something was added to it.
  useEffect(() => {
    if (open) logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeExchanges.length, open]);

  if (!active) return null;

  return createPortal(
    // Bottom-LEFT deliberately: the advisor panel's own collapsed toggle lives on the
    // right edge of the viewport (see AdvisorPanel.tsx), and a second floating AI
    // affordance stacked in the same corner reads as clutter, not two features.
    //
    // The offset itself has to clear `Sidebar.tsx`, which is `w-72` (288px) and always
    // visible from `md:` up (`DashboardLayout.tsx`'s `hidden md:flex`) — a bare `left-6`
    // put this button and its popup ON TOP OF the nav rail on any screen wide enough to
    // show one. Below `md` there is no persistent sidebar (a slide-out drawer instead,
    // closed by default), so the plain edge offset is fine there.
    //
    // Bottom-left is also where a line of text begins, so on a phone this button sat on
    // top of the report. Below `md` it moves to the right instead, clear of the advisor
    // rail (46px); the only other thing in that corner is a toast, and those stack above it.
    <div
      ref={panelRef}
      className="fixed bottom-6 z-[45] flex flex-col items-start
                 left-4 max-md:left-auto max-md:right-[64px] md:left-[19rem]"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="mb-3 w-[380px] max-w-[calc(100vw-2rem)] md:max-w-[calc(100vw-21rem)] h-[520px] max-h-[calc(100vh-8rem)] rounded-2xl border border-ld-accent-line bg-ld-surface shadow-ld-shadow-card overflow-hidden flex flex-col"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-ld-border shrink-0">
              <Sparkles className="w-4 h-4 text-ld-accent shrink-0" />
              <span className="text-[13px] font-semibold text-ld-text">Ask about this audit</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="ml-auto text-ld-text-3 hover:text-ld-text transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {subjects.length > 1 && (
              <div className="flex gap-1 px-4 pt-3 shrink-0">
                {subjects.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setActiveKey(s.key)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors',
                      s.key === active.key
                        ? 'bg-ld-accent-soft text-ld-accent'
                        : 'text-ld-text-3 hover:text-ld-text-2',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {/* Fixed-height log, not just a growing max-height: the popup reads as a real
                chat window from the moment it opens, not a thin strip that only becomes
                one after the first answer. */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
              {activeExchanges.length > 0 ? (
                <div className="space-y-4">
                  {activeExchanges.map((ex, i) => (
                    <div key={i} className="space-y-1.5">
                      <p className="text-[13px] font-semibold text-ld-text leading-snug">{ex.question}</p>
                      <div className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-ld-text-2">
                        <Sparkles className="mt-0.5 h-3 w-3 text-ld-accent shrink-0" />
                        <span>{ex.answer}</span>
                      </div>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4">
                  <Sparkles className="w-5 h-5 text-ld-accent-line" />
                  <p className="text-[12.5px] text-ld-text-3 leading-relaxed">
                    Ask anything about {subjects.length > 1 ? active.label : 'this audit'} — the answer comes from
                    exactly what it measured.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 pt-3 border-t border-ld-border shrink-0">
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={question}
                  onChange={(e) => setQuestion(e.target.value.slice(0, QUESTION_LIMIT))}
                  placeholder={outOfQuestions ? 'No questions left for this audit' : 'Ask a question…'}
                  disabled={disabled}
                  wrapperClassName="h-10"
                  className="text-[13.5px]"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="md"
                  disabled={disabled || !question.trim()}
                  aria-label="Send"
                >
                  {ask.isPending ? '…' : <ArrowRight className="w-[14px] h-[14px]" />}
                </Button>
              </form>

              {ask.isError && (
                <p className="mt-2 text-xs text-ld-rose">Could not get an answer — try again.</p>
              )}
              {!ask.isError && activeRemaining < MAX_QUESTIONS && (
                <p className="mt-2 text-xs text-ld-text-3">
                  {outOfQuestions ? 'No questions left for this audit.' : `${activeRemaining} of ${MAX_QUESTIONS} questions left.`}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close ask box' : 'Ask about this audit'}
        className="h-14 w-14 rounded-full grid place-items-center border border-ld-accent-line bg-ld-surface text-ld-accent shadow-ld-shadow-card hover:bg-ld-surface-hover transition-colors"
      >
        {open ? <X className="w-[22px] h-[22px]" /> : <Sparkles className="w-[22px] h-[22px]" />}
      </button>
    </div>,
    document.body,
  );
}
