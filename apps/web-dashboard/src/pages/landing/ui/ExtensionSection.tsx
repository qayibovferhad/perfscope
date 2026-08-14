import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/ui/button';

const METRIC_BADGES = [
  { t: 'LCP 1.4s',  good: true  },
  { t: 'CLS 0.05',  good: true  },
  { t: 'TBT 240ms', good: false },
] as const;

const BULLET_ITEMS = [
  {
    b: 'One click, current tab.',
    txt: 'Score and Core Web Vitals for whatever page is open — instantly, in place.',
    icon: <svg viewBox="0 0 24 24" fill="none"><path d="M13 2 4 13h6l-1 9 9-12h-6l1-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  },
  {
    b: 'Compare against your sites.',
    txt: "Stack the page you're on next to any project you've saved and see who wins, metric by metric.",
    icon: <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18M5 7l-3 5 3 3M19 7l3 5-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    b: 'Saved automatically.',
    txt: 'Every quick audit lands in your history, so the page you checked on Tuesday is still there on Friday.',
    icon: <svg viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
] as const;

const FAUX_LINES_TOP = ['70%', '90%', '50%'] as const;
const FAUX_LINES_BOT = ['80%', '40%'] as const;

export function ExtensionSection() {
  const navigate = useNavigate();

  return (
    <section id="extension" className="border-y border-[var(--ld-border)] bg-[var(--ld-bg-2)] py-[clamp(72px,11vw,140px)]">
      <div className="ld-wrap">
        <div className="grid grid-cols-1 min-[980px]:grid-cols-[1.05fr_0.95fr] gap-[clamp(36px,6vw,72px)] items-center">

          {/* Left: browser mock */}
          <div className="reveal">
            <div className="rounded-2xl border border-[var(--ld-border-strong)] bg-[var(--ld-surface)] overflow-hidden" style={{ boxShadow: 'var(--ld-shadow-card)' }}>

              {/* Title bar */}
              <div className="flex items-center gap-3 px-[14px] py-[11px] border-b border-[var(--ld-border)] bg-[var(--ld-surface-2)]">
                <span className="flex gap-[6px]">
                  {[0, 1, 2].map(i => <i key={i} className="w-[10px] h-[10px] rounded-full bg-[var(--ld-border-strong)] block not-italic" />)}
                </span>
                <span className="flex-1 flex items-center gap-2 font-mono text-[12.5px] text-[var(--ld-text-2)] px-3 py-[7px] rounded-lg bg-[var(--ld-bg-2)] border border-[var(--ld-border)]">
                  <svg viewBox="0 0 24 24" fill="none" className="w-[14px] h-[14px] text-[var(--ld-text-3)] shrink-0">
                    <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6"/>
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6"/>
                  </svg>
                  anywebsite.com
                </span>
                <span
                  className="w-[30px] h-[30px] rounded-lg grid place-items-center shrink-0"
                  style={{ background: 'var(--ld-grad)', boxShadow: 'var(--ld-glow)' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                    <path d="M3 12h3l2.5-7 4 14 3-9 2 2H21" stroke="#04130d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </div>

              {/* Body */}
              <div className="relative p-[22px] min-h-[300px]">
                {/* Faux page skeleton */}
                <div className="grid gap-[14px] opacity-50">
                  {FAUX_LINES_TOP.map((w, i) => (
                    <div key={i} className="h-[11px] rounded-[5px] bg-[var(--ld-surface-hover)]" style={{ width: w }} />
                  ))}
                  <div className="h-[90px] rounded-xl bg-[var(--ld-surface-hover)] my-1" />
                  {FAUX_LINES_BOT.map((w, i) => (
                    <div key={i} className="h-[11px] rounded-[5px] bg-[var(--ld-surface-hover)]" style={{ width: w }} />
                  ))}
                </div>

                {/* Extension popup */}
                <div
                  className="absolute top-4 right-4 w-[250px] rounded-[14px] border border-[var(--ld-border-strong)] bg-[var(--ld-surface)] p-4"
                  style={{ boxShadow: '0 24px 60px -20px rgba(0,0,0,.6), var(--ld-glow)' }}
                >
                  {/* Popup header */}
                  <div className="flex items-center justify-between font-mono text-[13px] font-semibold mb-[14px] text-[var(--ld-text)]">
                    <span>PerfScope</span>
                    <span className="inline-flex items-center gap-[6px] text-[10.5px] text-[var(--ld-accent-2)] font-semibold">
                      <span className="ld-pulse w-[6px] h-[6px] rounded-full bg-current inline-block" />
                      this tab
                    </span>
                  </div>

                  {/* Score + badges */}
                  <div className="flex items-center gap-[14px]">
                    <div className="relative w-[56px] h-[56px] shrink-0">
                      <svg viewBox="0 0 56 56" className="w-[56px] h-[56px]">
                        <circle cx="28" cy="28" r="23" fill="none" stroke="var(--ld-border)" strokeWidth="6"/>
                        <circle cx="28" cy="28" r="23" fill="none" stroke="var(--ld-accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray="144.5" strokeDashoffset="24.5" transform="rotate(-90 28 28)"/>
                      </svg>
                      <b className="absolute inset-0 grid place-items-center font-mono text-[18px] font-semibold text-[var(--ld-accent-2)]">83</b>
                    </div>
                    <div className="flex flex-wrap gap-[6px]">
                      {METRIC_BADGES.map(({ t, good }) => (
                        <span
                          key={t}
                          className={`font-mono text-[10.5px] px-2 py-1 rounded-[7px] font-semibold ${
                            good
                              ? 'text-[var(--ld-accent-2)] border border-[rgba(20,192,138,.25)] bg-[var(--ld-accent-soft)]'
                              : 'text-[var(--ld-amber)] border border-ld-amber-line bg-ld-amber-soft'
                          }`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Compare row */}
                  <div className="flex items-center justify-between gap-[10px] mt-[14px] pt-[14px] border-t border-[var(--ld-border)] font-mono text-[11.5px] text-[var(--ld-text-3)]">
                    <span>Compare with</span>
                    <span className="inline-flex items-center gap-[6px] px-[9px] py-[5px] rounded-lg border border-[var(--ld-border-strong)] bg-[var(--ld-bg-2)] text-[var(--ld-text)] text-[11.5px] font-semibold">
                      my-store.com
                      <svg viewBox="0 0 24 24" fill="none" className="w-[13px] h-[13px] text-[var(--ld-text-3)]">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  </div>

                  {/* Score comparison */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mt-3">
                    <div className="grid gap-[2px] text-center px-[6px] py-[10px] rounded-[10px] border border-[var(--ld-border)] bg-[var(--ld-surface-2)]">
                      <b className="font-mono text-[22px] font-semibold text-[var(--ld-text-2)]">83</b>
                      <span className="text-[10px] text-[var(--ld-text-3)]">this tab</span>
                    </div>
                    <span className="font-mono text-[11px] text-[var(--ld-text-3)]">vs</span>
                    <div className="grid gap-[2px] text-center px-[6px] py-[10px] rounded-[10px] border border-[var(--ld-accent-line)] bg-[var(--ld-accent-soft)]">
                      <b className="font-mono text-[22px] font-semibold text-[var(--ld-accent-2)]">95</b>
                      <span className="text-[10px] text-[var(--ld-text-3)]">my-store.com</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: copy */}
          <div className="reveal">
            <span className="ld-eyebrow block mb-4">Browser extension</span>
            <h2 className="ld-h-section text-[var(--ld-text)]">Audit any page you're standing on.</h2>
            <p className="ld-lead mt-[18px]">
              Pin PerfScope to your toolbar and the whole web becomes auditable. Land on a competitor, a client's site, or a random page that feels slow — one click runs a full check on the tab you're already looking at.
            </p>
            <ul className="list-none grid gap-4 mt-7 p-0">
              {BULLET_ITEMS.map(({ icon, b, txt }) => (
                <li key={b} className="flex gap-[14px] items-start">
                  <span className="w-[38px] h-[38px] shrink-0 rounded-[10px] grid place-items-center border border-[var(--ld-border-strong)] bg-[var(--ld-surface-2)] text-[var(--ld-accent)]">
                    {icon}
                  </span>
                  <div className="text-[14.5px] text-[var(--ld-text-2)] leading-[1.5]">
                    <b className="text-[var(--ld-text)] font-semibold">{b}</b> {txt}
                  </div>
                </li>
              ))}
            </ul>
            <Button size="lg" className="mt-7" onClick={() => navigate('/app')}>
              <ShieldCheck className="w-4 h-4" />
              Add to your browser
            </Button>
          </div>

        </div>
      </div>
    </section>
  );
}
