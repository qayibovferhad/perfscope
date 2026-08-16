import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { useAskQuestion } from '../model/useAskQuestion';

interface Props {
  analysisId: string;
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
export function AskAboutAudit({ analysisId }: Props) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [remaining, setRemaining] = useState(MAX_QUESTIONS);
  const ask = useAskQuestion(analysisId);
  const panelRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const outOfQuestions = remaining <= 0;
  const disabled = outOfQuestions || ask.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || disabled) return;

    ask.mutate(q, {
      onSuccess: (data) => {
        setExchanges(prev => [...prev, { question: q, answer: data.answer }]);
        setRemaining(data.questionsRemaining);
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

  // New exchange arrives below the fold of a growing log — keep it in view.
  useEffect(() => {
    if (open) logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [exchanges, open]);

  return createPortal(
    // Bottom-LEFT deliberately: the advisor panel's own collapsed toggle lives on the
    // right edge of the viewport (see AdvisorPanel.tsx), and a second floating AI
    // affordance stacked in the same corner reads as clutter, not two features.
    <div ref={panelRef} className="fixed bottom-6 left-6 z-[45] flex flex-col items-start">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="mb-3 w-[340px] max-w-[calc(100vw-3rem)] rounded-2xl border border-ld-accent-line bg-ld-surface shadow-ld-shadow-card overflow-hidden flex flex-col"
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

            {exchanges.length > 0 && (
              <div className="max-h-[280px] overflow-y-auto px-4 py-3 space-y-3">
                {exchanges.map((ex, i) => (
                  <div key={i} className="space-y-1.5">
                    <p className="text-[12.5px] font-semibold text-ld-text leading-snug">{ex.question}</p>
                    <div className="flex items-start gap-1.5 text-xs leading-relaxed text-ld-text-2">
                      <Sparkles className="mt-0.5 h-3 w-3 text-ld-accent shrink-0" />
                      <span>{ex.answer}</span>
                    </div>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}

            <div className="p-4 pt-3 border-t border-ld-border shrink-0">
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={question}
                  onChange={(e) => setQuestion(e.target.value.slice(0, QUESTION_LIMIT))}
                  placeholder={outOfQuestions ? 'No questions left for this audit' : 'Ask a question…'}
                  disabled={disabled}
                  wrapperClassName="h-9"
                  className="text-[13px]"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={disabled || !question.trim()}
                  aria-label="Send"
                >
                  {ask.isPending ? '…' : <ArrowRight className="w-[13px] h-[13px]" />}
                </Button>
              </form>

              {ask.isError && (
                <p className="mt-2 text-xs text-ld-rose">Could not get an answer — try again.</p>
              )}
              {!ask.isError && remaining < MAX_QUESTIONS && (
                <p className="mt-2 text-xs text-ld-text-3">
                  {outOfQuestions ? 'No questions left for this audit.' : `${remaining} of ${MAX_QUESTIONS} questions left.`}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close ask box' : 'Ask about this audit'}
        className="h-12 w-12 rounded-full grid place-items-center border border-ld-accent-line bg-ld-surface text-ld-accent shadow-ld-shadow-card hover:bg-ld-surface-hover transition-colors"
      >
        {open ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>
    </div>,
    document.body,
  );
}
