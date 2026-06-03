import { useState, useRef, useEffect } from 'react';

const FAQS = [
  {
    q: 'How is PerfScope different from Lighthouse?',
    a: "We use the same engine, but build on top of it: we keep results over time, diff any two audits, show CLS frame by frame, and attach a concrete fix to every weak metric. So you don't just get a score — you get the answer to \"what now?\"",
  },
  {
    q: 'Is it free, and do I need a card?',
    a: 'Running your first audit needs no card and no sign-up. The project is open source under an MIT license, so you can also self-host and run it yourself.',
  },
  {
    q: 'Which pages can I check?',
    a: 'Any publicly reachable URL — a marketing page, a product page, a blog or a full web app. You can run the audit separately in mobile and desktop environments.',
  },
  {
    q: "Can it plug into my team's CI/CD?",
    a: 'Yes. Run an audit automatically after every deploy, and stop the build or send an alert when performance drops below a threshold you set. Regressions get caught before they reach users.',
  },
  {
    q: 'How reliable are the fix suggestions?',
    a: 'Every suggestion is tied to a specific metric and a real cause found in the audit — like which image is delaying LCP, or which element is causing layout shift. We hand you copy-paste-ready code; the decision stays yours.',
  },
] as const;

function FAQItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = answerRef.current;
    if (!el) return;
    el.style.maxHeight = open ? el.scrollHeight + 'px' : '0';
  }, [open]);

  return (
    <div className={`rounded-[14px] border bg-[var(--ld-surface)] overflow-hidden transition-[border-color] duration-[250ms] ${open ? 'border-[var(--ld-accent-line)]' : 'border-[var(--ld-border)]'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-[22px] py-5 text-left text-[16.5px] font-semibold text-[var(--ld-text)] bg-transparent border-none cursor-pointer font-[inherit]"
      >
        {q}
        <span className={`w-6 h-6 shrink-0 grid place-items-center text-[var(--ld-accent)] transition-transform duration-300 ${open ? 'rotate-45' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </span>
      </button>
      <div ref={answerRef} className="overflow-hidden transition-[max-height] duration-[350ms] ease-[ease]" style={{ maxHeight: 0 }}>
        <p className="px-[22px] pb-[22px] text-[var(--ld-text-2)] text-[14.5px] max-w-[64ch] m-0">{a}</p>
      </div>
    </div>
  );
}

export function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  function toggle(i: number) {
    setOpenIdx(prev => prev === i ? null : i);
  }

  return (
    <section id="faq" className="border-y border-[var(--ld-border)] bg-[var(--ld-bg-2)] py-[clamp(72px,11vw,140px)]">
      <div className="ld-wrap">
        <div className="reveal text-center max-w-[720px] mx-auto mb-[clamp(44px,6vw,70px)]">
          <span className="ld-eyebrow block mb-4">Frequently asked</span>
          <h2 className="ld-h-section text-[var(--ld-text)]">Before you start.</h2>
        </div>
        <div className="reveal max-w-[820px] mx-auto grid gap-3">
          {FAQS.map((item, i) => (
            <FAQItem key={item.q} q={item.q} a={item.a} open={openIdx === i} onToggle={() => toggle(i)} />
          ))}
        </div>
      </div>
    </section>
  );
}
