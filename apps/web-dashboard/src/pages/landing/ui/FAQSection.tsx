import { useState, useRef, useEffect } from 'react';

const faqs = [
  {
    q: 'How is PerfScope different from Lighthouse?',
    a: 'We use the same engine, but build on top of it: we keep results over time, diff any two audits, show CLS frame by frame, and attach a concrete fix to every weak metric. So you don\'t just get a score — you get the answer to "what now?"',
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
    q: 'Can it plug into my team\'s CI/CD?',
    a: 'Yes. Run an audit automatically after every deploy, and stop the build or send an alert when performance drops below a threshold you set. Regressions get caught before they reach users.',
  },
  {
    q: 'How reliable are the fix suggestions?',
    a: 'Every suggestion is tied to a specific metric and a real cause found in the audit — like which image is delaying LCP, or which element is causing layout shift. We hand you copy-paste-ready code; the decision stays yours.',
  },
];

function FAQItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = answerRef.current;
    if (!el) return;
    el.style.maxHeight = open ? el.scrollHeight + 'px' : '0';
  }, [open]);

  return (
    <div style={{
      border: `1px solid ${open ? 'var(--ld-accent-line)' : 'var(--ld-border)'}`,
      borderRadius: 14, background: 'var(--ld-surface)', overflow: 'hidden',
      transition: 'border-color .25s',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          padding: '20px 22px', textAlign: 'left', fontSize: 16.5, fontWeight: 600, color: 'var(--ld-text)',
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {q}
        <span style={{ width: 24, height: 24, flexShrink: 0, display: 'grid', placeItems: 'center', color: 'var(--ld-accent)', transform: open ? 'rotate(45deg)' : '', transition: 'transform .3s' }}>
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 18, height: 18 }}>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </span>
      </button>
      <div
        ref={answerRef}
        style={{ maxHeight: 0, overflow: 'hidden', transition: 'max-height .35s ease' }}
      >
        <p style={{ padding: '0 22px 22px', color: 'var(--ld-text-2)', fontSize: 14.5, maxWidth: '64ch', margin: 0 }}>{a}</p>
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
    <section id="faq" style={{ background: 'var(--ld-bg-2)', borderBlock: '1px solid var(--ld-border)', padding: 'clamp(72px, 11vw, 140px) 0' }}>
      <div className="ld-wrap">
        <div className="reveal" style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto', marginBottom: 'clamp(44px, 6vw, 70px)' }}>
          <span className="ld-eyebrow" style={{ display: 'block', marginBottom: 16 }}>Frequently asked</span>
          <h2 className="ld-h-section" style={{ color: 'var(--ld-text)' }}>Before you start.</h2>
        </div>
        <div className="reveal" style={{ maxWidth: 820, margin: '0 auto', display: 'grid', gap: 12 }}>
          {faqs.map((item, i) => (
            <FAQItem key={item.q} q={item.q} a={item.a} open={openIdx === i} onToggle={() => toggle(i)} />
          ))}
        </div>
      </div>
    </section>
  );
}
