import { useState, type FormEvent } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { useAskQuestion } from '../model/useAskQuestion';

interface Props {
  analysisId: string;
}

const MAX_QUESTIONS = 5;
const QUESTION_LIMIT = 500;

/**
 * The line under the page's AiCard: "Ask about this." The analyzer's monologue, made
 * answerable — the answer is built from exactly the evidence `analysePage` saw, nothing
 * more, so it cannot say something the diagnosis above it would disagree with.
 *
 * No conversation history by design: each question is independent, and five per audit
 * (server-enforced) keeps the cost of "just ask" bounded. `questionsRemaining` comes back
 * with every answer, so the box disables itself before a sixth attempt ever round-trips.
 */
export function AskAboutAudit({ analysisId }: Props) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(MAX_QUESTIONS);
  const ask = useAskQuestion(analysisId);

  const outOfQuestions = remaining <= 0;
  const disabled = outOfQuestions || ask.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || disabled) return;

    ask.mutate(q, {
      onSuccess: (data) => {
        setAnswer(data.answer);
        setRemaining(data.questionsRemaining);
        setQuestion('');
      },
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-ld-border-strong bg-ld-surface px-5 py-4">
      {answer && (
        <div className="mb-3 flex items-start gap-1.5 text-xs leading-relaxed text-ld-text-2">
          <Sparkles className="mt-0.5 h-3 w-3 text-ld-accent shrink-0" />
          <span>{answer}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, QUESTION_LIMIT))}
          placeholder={outOfQuestions ? "You've asked the most this audit allows" : 'Ask about this audit'}
          disabled={disabled}
          wrapperClassName="h-9"
          className="text-[13px]"
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={disabled || !question.trim()}
        >
          {ask.isPending ? 'Asking…' : 'Ask'}
          {!ask.isPending && <ArrowRight className="w-[13px] h-[13px]" />}
        </Button>
      </form>

      {ask.isError && (
        <p className="mt-2 text-xs text-ld-rose">
          Could not get an answer — try again.
        </p>
      )}
      {/* Silent until it matters — a "5 of 5 left" hint under an untouched box is noise;
          once the count has actually moved, it is the thing to say. */}
      {!ask.isError && remaining < MAX_QUESTIONS && (
        <p className="mt-2 text-xs text-ld-text-3">
          {outOfQuestions ? 'No questions left for this audit.' : `${remaining} of ${MAX_QUESTIONS} questions left for this audit.`}
        </p>
      )}
    </div>
  );
}
