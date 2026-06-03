import { useState, useEffect, useRef, useCallback } from 'react';

function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }

const STEPS = [
  {
    n: '01',
    title: 'Paste a URL',
    desc: 'Give us the address of a live page. PerfScope loads it in a real mobile and desktop environment — exactly as your visitors see it.',
  },
  {
    n: '02',
    title: 'Watch the audit run',
    desc: 'Lighthouse score, Core Web Vitals and the network waterfall stream in live. A frame-by-frame CLS filmstrip sits right alongside them.',
  },
  {
    n: '03',
    title: 'Get a fix plan',
    desc: 'Each weak metric comes with a root-cause explanation and a copy-paste-ready code suggestion — prioritized, with the highest-impact fix on top.',
  },
];

export function HowItWorksSection() {
  const [active, setActive] = useState(0);
  const [score2, setScore2] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const scoreRaf = useRef<number | null>(null);

  function animateScore() {
    if (scoreRaf.current) cancelAnimationFrame(scoreRaf.current);
    const dur = 750;
    const t0 = performance.now();
    function tick(now: number) {
      const p = Math.min(1, (now - t0) / dur);
      setScore2(Math.round(94 * easeOut(p)));
      if (p < 1) scoreRaf.current = requestAnimationFrame(tick);
    }
    scoreRaf.current = requestAnimationFrame(tick);
  }

  const goStep = useCallback((i: number) => {
    setActive(i);
    if (i === 1) animateScore();
  }, []);

  const play = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % 3;
        if (next === 1) animateScore();
        return next;
      });
    }, 2200);
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Start on scroll into view
  useEffect(() => {
    const el = stepsRef.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { goStep(0); play(); return; }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !startedRef.current) {
          startedRef.current = true;
          goStep(0);
          play();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => { io.disconnect(); stop(); };
  }, [goStep, play, stop]);

  return (
    <section style={{ padding: 'clamp(72px, 11vw, 140px) 0' }} id="how">
      <div className="ld-wrap">
        <div className="sec-head reveal" style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto', marginBottom: 'clamp(44px, 6vw, 70px)' }}>
          <span className="ld-eyebrow" style={{ display: 'block', marginBottom: 16 }}>How it works</span>
          <h2 className="ld-h-section" style={{ color: 'var(--ld-text)' }}>Three steps. Nothing to install.</h2>
          <p className="ld-lead" style={{ margin: '18px auto 0' }}>No downloads, no agents to maintain. Paste a link — we handle the rest.</p>
        </div>

        {/* Progress rail + steps */}
        <div
          ref={stepsRef}
          style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22, paddingTop: 26 }}
          className="ld-steps-wrap"
          onMouseEnter={stop}
          onMouseLeave={play}
        >
          {/* Rail */}
          <div style={{ position: 'absolute', top: 0, left: 8, right: 8, height: 3, borderRadius: 3, background: 'var(--ld-border-strong)', overflow: 'hidden' }}>
            <span style={{
              display: 'block', height: '100%', borderRadius: 3,
              background: 'var(--ld-grad)', boxShadow: '0 0 12px var(--ld-accent-soft)',
              width: `${(active + 1) * 33.33}%`,
              transition: 'width .38s cubic-bezier(.4,.8,.3,1)',
            }} />
          </div>

          {STEPS.map((step, idx) => {
            const isActive = idx === active;
            return (
              <button
                key={step.n}
                type="button"
                onClick={() => { goStep(idx); play(); }}
                className={`reveal ${isActive ? 'step-active' : ''}`}
                style={{
                  textAlign: 'left', padding: 26, borderRadius: 16,
                  border: `1px solid ${isActive ? 'var(--ld-accent-line)' : 'var(--ld-border)'}`,
                  background: isActive ? 'var(--ld-surface-2)' : 'var(--ld-surface)',
                  cursor: 'pointer',
                  opacity: isActive ? 1 : 0.62,
                  transform: isActive ? 'translateY(-4px)' : '',
                  boxShadow: isActive ? '0 0 0 1px var(--ld-accent-soft), 0 24px 50px -28px rgba(20,192,138,.55)' : '',
                  transition: 'border-color .3s, transform .3s, background .3s, box-shadow .3s, opacity .3s',
                  fontFamily: 'inherit',
                  color: 'inherit',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.opacity = '.85'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.opacity = '.62'; }}
              >
                {/* Step head */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: isActive ? '#04130d' : 'var(--ld-text-3)',
                    width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center',
                    border: isActive ? '1px solid transparent' : '1px solid var(--ld-border)',
                    background: isActive ? 'var(--ld-grad)' : 'var(--ld-bg-2)',
                    boxShadow: isActive ? 'var(--ld-glow)' : '',
                    fontFamily: "'Geist Mono', monospace",
                    flexShrink: 0, transition: 'all .3s',
                  }}>
                    {step.n}
                  </div>
                  <h3 style={{ fontSize: 18.5, fontWeight: 700, color: 'var(--ld-text)', lineHeight: 1.04, margin: 0 }}>{step.title}</h3>
                </div>
                <p style={{ color: 'var(--ld-text-2)', fontSize: 14.5, margin: 0 }}>{step.desc}</p>

                {/* Mini visual */}
                <div style={{
                  marginTop: 18, height: 64, borderRadius: 12, border: '1px solid var(--ld-border)',
                  background: 'var(--ld-bg-2)', padding: '0 14px', display: 'flex', alignItems: 'center', overflow: 'hidden',
                }}>
                  {idx === 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%' }}>
                      <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16, color: 'var(--ld-text-3)', flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
                        <path d="M3 12h18M12 3c2.4 2.3 2.4 15.7 0 18M12 3c-2.4 2.3-2.4 15.7 0 18" stroke="currentColor" strokeWidth="1.3"/>
                      </svg>
                      <span className="vz-typed">https://yoursite.com</span>
                      <span className="vz-caret" />
                    </div>
                  )}
                  {idx === 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
                      <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--ld-accent-2)', lineHeight: 1, minWidth: 38, fontFamily: "'Geist Mono', monospace" }}>{isActive ? score2 : 0}</span>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 40, flex: 1 }}>
                        {(['38%','64%','46%','82%','58%','90%'] as const).map((h, i) => (
                          <i key={i} className="vz-bars" style={{ '--h': h } as React.CSSProperties & { '--h': string }} />
                        ))}
                      </div>
                    </div>
                  )}
                  {idx === 2 && (
                    <div style={{ display: 'grid', gap: 5, width: '100%', padding: '6px 0' }}>
                      {['Defer offscreen images', 'Set width & height on hero', 'Preconnect to font host'].map(fix => (
                        <span key={fix} className="vz-fix-row">
                          <span style={{ width: 16, height: 16, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--ld-accent-soft)', color: 'var(--ld-accent)', flexShrink: 0 }}>
                            <svg viewBox="0 0 24 24" fill="none" style={{ width: 10, height: 10 }}>
                              <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </span>
                          {fix}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .ld-steps-wrap {
            grid-template-columns: 1fr !important;
            padding-top: 0 !important;
          }
          .ld-steps-wrap > div:first-child { display: none; }
        }
        .vz-bars { flex: 1; height: 6px; border-radius: 3px 3px 0 0; background: var(--ld-accent-line); display: block; }
      `}</style>
    </section>
  );
}
