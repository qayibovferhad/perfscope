import { useState, useRef, useEffect } from 'react';

const FAQS = [
  {
    q: 'How is PerfScope different from Lighthouse?',
    a: 'Same engine, different questions. Lighthouse answers "what is the score now". PerfScope keeps every run, compares each one with the previous run of the same page, shows the element behind every failing check, and holds a budget on a schedule and in CI. The score is where it starts, not where it stops.',
  },
  {
    q: 'Is it free?',
    a: 'Yes. PerfScope is MIT-licensed. An account is needed because history, budgets and schedules belong to somebody, but there is no plan and no card. You can also run the whole thing on your own machine or server.',
  },
  {
    q: 'Which pages can I check?',
    a: 'Any URL a Chrome on the server can reach, as mobile or desktop. Pages behind a login work too: you sign in once in a browser PerfScope opens, and it reuses that session for every audit of the same origin. A self-hosted install can audit an intranet.',
  },
  {
    q: 'Can it fail my build?',
    a: 'That is what the CLI is for. `perfscope ci --url … --budget "performance=80,lcp=2500"` runs one audit and exits 1 when the budget is missed — and 2 when the page could not be measured at all, so the pipeline can tell the two apart. The GitHub Action wraps it in a comment on the pull request and a check on the commit.',
  },
  {
    q: 'What does the AI do, and what if I do not want it?',
    a: 'With a Gemini key configured, every failing audit gets an explanation and a suggested fix, written from the audit\'s own evidence — the request, the element, the timing. Without a key the feature is simply off; nothing else changes.',
  },
  {
    q: 'How do I run it myself?',
    a: 'Two images, one compose file, one env file. The backend image carries its own Chromium; the dashboard is static behind nginx. Docker is the only prerequisite on the host. Development runs on a laptop with Node 22, pnpm and a local Chrome.',
  },
] as const;

function FAQItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = answerRef.current;
    if (!el) return;
    // The open height is the content's own; there is no class for a measured pixel value.
    el.style.maxHeight = open ? `${el.scrollHeight}px` : '0';
  }, [open]);

  return (
    <div className={`rounded-[14px] border bg-ld-surface overflow-hidden transition-[border-color] duration-[250ms] ${open ? 'border-ld-accent-line' : 'border-ld-border'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-[22px] py-5 text-left text-[16.5px] font-semibold text-ld-text bg-transparent border-none cursor-pointer font-[inherit]"
      >
        {q}
        <span className={`w-6 h-6 shrink-0 grid place-items-center text-ld-accent transition-transform duration-300 ${open ? 'rotate-45' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </span>
      </button>
      <div ref={answerRef} className="overflow-hidden transition-[max-height] duration-[350ms] ease-[ease] max-h-0">
        <p className="px-[22px] pb-[22px] text-ld-text-2 text-[14.5px] max-w-[68ch] m-0 leading-[1.6]">{a}</p>
      </div>
    </div>
  );
}

export function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faq" className="py-[clamp(72px,11vw,140px)]">
      <div className="ld-wrap">
        <div className="reveal text-center max-w-[720px] mx-auto mb-[clamp(44px,6vw,70px)]">
          <span className="ld-eyebrow block mb-4">Frequently asked</span>
          <h2 className="ld-h-section text-ld-text">Before you start.</h2>
        </div>
        <div className="reveal max-w-[820px] mx-auto grid gap-3">
          {FAQS.map((item, i) => (
            <FAQItem key={item.q} q={item.q} a={item.a} open={openIdx === i} onToggle={() => setOpenIdx(prev => prev === i ? null : i)} />
          ))}
        </div>
      </div>
    </section>
  );
}
