import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { easeOut } from '../lib/animations';

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
] as const;

const BAR_HEIGHTS = ['38%', '64%', '46%', '82%', '58%', '90%'] as const;
const FIX_ITEMS   = ['Defer offscreen images', 'Set width & height on hero', 'Preconnect to font host'] as const;

export function HowItWorksSection() {
  const [active, setActive]   = useState(0);
  const [score2, setScore2]   = useState(0);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepsRef    = useRef<HTMLDivElement>(null);
  const startedRef  = useRef(false);
  const scoreRaf    = useRef<number | null>(null);

  function animateScore() {
    if (scoreRaf.current) cancelAnimationFrame(scoreRaf.current);
    const dur = 750;
    const t0  = performance.now();
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
        const next = prev + 1;
        if (next >= 3) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return prev;
        }
        if (next === 1) animateScore();
        return next;
      });
    }, 1400);
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // The animation starts when an IntersectionObserver says the section is on screen: the
  // browser is the source of that event, and the no-observer fallback starts it the same way.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const el = stepsRef.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { goStep(0); play(); return; }
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !startedRef.current) {
        startedRef.current = true;
        goStep(0);
        play();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); stop(); };
  }, [goStep, play, stop]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <section className="py-[clamp(72px,11vw,140px)]" id="how">
      <div className="ld-wrap">

        {/* Header */}
        <div className="sec-head reveal text-center max-w-[720px] mx-auto mb-[clamp(44px,6vw,70px)]">
          <span className="ld-eyebrow block mb-4">How it works</span>
          <h2 className="ld-h-section text-[var(--ld-text)]">Three steps. Nothing to install.</h2>
          <p className="ld-lead mt-[18px] mx-auto">No downloads, no agents to maintain. Paste a link — we handle the rest.</p>
        </div>

        {/* Progress rail + steps */}
        <div
          ref={stepsRef}
          className="relative grid grid-cols-1 min-[980px]:grid-cols-3 gap-[22px] min-[980px]:pt-[26px]"
          onMouseEnter={stop}
          onMouseLeave={play}
        >
          {/* Rail — visible only on wide screens */}
          <div className="absolute top-0 left-2 right-2 h-[3px] rounded-full bg-[var(--ld-border-strong)] overflow-hidden hidden min-[980px]:block">
            <span
              className="block h-full rounded-full transition-[width] duration-[380ms] ease-[cubic-bezier(.4,.8,.3,1)]"
              style={{
                width: `${(active + 1) * 33.33}%`,
                background: 'var(--ld-grad)',
                boxShadow: '0 0 12px var(--ld-accent-soft)',
              }}
            />
          </div>

          {STEPS.map((step, idx) => {
            const isActive = idx === active;
            return (
              <button
                key={step.n}
                type="button"
                onClick={() => { goStep(idx); play(); }}
                className={[
                  'reveal text-left p-[26px] rounded-2xl border font-[inherit] text-[inherit] cursor-pointer',
                  'transition-[border-color,transform,background,box-shadow] duration-300',
                  // The inactive state is carried by the border and background, not by
                  // fading the whole card: opacity 0.62 dragged the text tokens inside it
                  // down to 2.62:1 and 4.2:1, well under WCAG AA, so the step you were not
                  // reading was also the step you could not read.
                  isActive
                    ? 'step-active border-[var(--ld-accent-line)] bg-[var(--ld-surface-2)] -translate-y-1'
                    : 'border-[var(--ld-border)] bg-[var(--ld-surface)] hover:border-[var(--ld-border-strong)]',
                ].join(' ')}
                style={isActive ? { boxShadow: '0 0 0 1px var(--ld-accent-soft), 0 24px 50px -28px rgba(20,192,138,.55)' } : undefined}
              >
                {/* Step head */}
                <div className="flex items-center gap-[14px] mb-[14px]">
                  <div
                    className="font-mono text-[13px] font-semibold w-9 h-9 rounded-[10px] grid place-items-center shrink-0 transition-all duration-300"
                    style={{
                      color:      isActive ? '#04130d' : 'var(--ld-text-3)',
                      border:     isActive ? '1px solid transparent' : '1px solid var(--ld-border)',
                      background: isActive ? 'var(--ld-grad)' : 'var(--ld-bg-2)',
                      boxShadow:  isActive ? 'var(--ld-glow)' : '',
                    }}
                  >
                    {step.n}
                  </div>
                  <h3 className="text-[18.5px] font-bold text-[var(--ld-text)] leading-[1.04] m-0">{step.title}</h3>
                </div>

                <p className="text-[var(--ld-text-2)] text-[14.5px] m-0">{step.desc}</p>

                {/* Mini visual */}
                <div className="mt-[18px] min-h-16 rounded-xl border border-[var(--ld-border)] bg-[var(--ld-bg-2)] px-[14px] flex items-center overflow-hidden">
                  {idx === 0 && (
                    <div className="flex items-center gap-[9px] w-full">
                      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-[var(--ld-text-3)] shrink-0">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
                        <path d="M3 12h18M12 3c2.4 2.3 2.4 15.7 0 18M12 3c-2.4 2.3-2.4 15.7 0 18" stroke="currentColor" strokeWidth="1.3"/>
                      </svg>
                      <span className="vz-typed">https://yoursite.com</span>
                      <span className="vz-caret" />
                    </div>
                  )}
                  {idx === 1 && (
                    <div className="flex items-center gap-[14px] w-full">
                      <span className="font-mono text-[26px] font-semibold text-[var(--ld-accent-2)] leading-none min-w-[38px]">
                        {isActive ? score2 : 0}
                      </span>
                      <div className="vz-bars flex items-end gap-[5px] h-10 flex-1">
                        {BAR_HEIGHTS.map((h, i) => (
                          <i key={i} style={{ '--h': h } as CSSProperties} />
                        ))}
                      </div>
                    </div>
                  )}
                  {idx === 2 && (
                    <div className="grid gap-[5px] w-full py-5">
                      {FIX_ITEMS.map(fix => (
                        <span key={fix} className="vz-fix-row">
                          <span className="w-4 h-4 rounded-full grid place-items-center bg-[var(--ld-accent-soft)] text-[var(--ld-accent)] shrink-0">
                            <svg viewBox="0 0 24 24" fill="none" className="w-[10px] h-[10px]">
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
    </section>
  );
}
