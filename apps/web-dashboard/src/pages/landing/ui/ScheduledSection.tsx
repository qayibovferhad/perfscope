import { useState } from 'react';

type Freq = 'Daily' | 'Weekdays' | 'Weekly';

const BULLET_ITEMS = [
  {
    b: 'Your time, your timezone.',
    txt: 'Daily, weekdays, or weekly — whatever rhythm fits your team.',
    icon: <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    b: 'Always a comparison.',
    txt: 'Each report diffs against yesterday, so a regression jumps out instead of hiding in a number.',
    icon: <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18M5 7l-3 5 3 3M19 7l3 5-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    b: 'Email, Slack or both.',
    txt: 'Send it to a person or a channel. Quiet on good days, loud when a score drops.',
    icon: <svg viewBox="0 0 24 24" fill="none"><path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7"/></svg>,
  },
] as const;

const EMAIL_METRICS = [
  { k: 'LCP', v: '1.1s',  d: '−0.1s', good: true  },
  { k: 'CLS', v: '0.03',  d: 'steady', good: true  },
  { k: 'TBT', v: '180ms', d: '+20ms',  good: false },
] as const;

const FREQS: Freq[] = ['Daily', 'Weekdays', 'Weekly'];

function fmtTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

function nextWord(freq: Freq) {
  if (freq === 'Weekly')   return 'Monday';
  if (freq === 'Weekdays') return 'the next weekday';
  return 'tomorrow';
}

export function ScheduledSection() {
  const [schedOn, setSchedOn] = useState(true);
  const [freq, setFreq]       = useState<Freq>('Daily');
  const [mins, setMins]       = useState(7 * 60);

  function stepTime(delta: number) {
    setMins(prev => (prev + delta + 1440) % 1440);
  }

  const summaryText = schedOn
    ? `Next report — ${nextWord(freq)} at ${fmtTime(mins)}`
    : 'Daily report is paused';

  return (
    <section className="py-[clamp(72px,11vw,140px)]" id="reports">
      <div className="ld-wrap">
        <div className="grid grid-cols-1 min-[980px]:grid-cols-2 gap-[clamp(36px,6vw,76px)] items-center">

          {/* Left */}
          <div className="reveal">
            <span className="ld-eyebrow block mb-4">Set it and forget it</span>
            <h2 className="ld-h-section text-[var(--ld-text)]">Wake up to a report.<br />Without opening a tab.</h2>
            <p className="ld-lead mt-5">
              Pick a time once. Every day, PerfScope audits your pages on its own and drops a clean summary in your inbox — what changed, what slipped, what to fix.
            </p>
            <ul className="grid gap-[18px] mt-[30px] list-none p-0">
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
          </div>

          {/* Right */}
          <div className="reveal grid gap-4">

            {/* Scheduler card */}
            <div className="rounded-[18px] border border-[var(--ld-border-strong)] bg-[var(--ld-surface)] p-[22px]" style={{ boxShadow: 'var(--ld-shadow-card)' }}>

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <span className="font-mono text-[13px] text-[var(--ld-text-2)] tracking-[.04em]">Daily report</span>
                <label className="relative inline-flex cursor-pointer">
                  <input type="checkbox" checked={schedOn} onChange={e => setSchedOn(e.target.checked)} className="absolute opacity-0 w-0 h-0" />
                  <span
                    className="w-[42px] h-6 rounded-full block transition-[background,border-color] duration-[250ms]"
                    style={{
                      background:   schedOn ? 'var(--ld-accent-soft)' : 'var(--ld-surface-hover)',
                      border:       `1px solid ${schedOn ? 'var(--ld-accent-line)' : 'var(--ld-border-strong)'}`,
                    }}
                  >
                    <span
                      className="absolute top-1 w-4 h-4 rounded-full transition-[left,background] duration-[250ms]"
                      style={{
                        left:       schedOn ? 22 : 4,
                        background: schedOn ? 'var(--ld-accent)' : 'var(--ld-text-3)',
                      }}
                    />
                  </span>
                </label>
              </div>

              {/* Frequency */}
              <div className="flex items-center justify-between gap-[14px] py-[13px] border-t border-[var(--ld-border)]">
                <span className="font-mono text-[11px] tracking-[.1em] text-[var(--ld-text-3)]">FREQUENCY</span>
                <div className="flex gap-1 p-[3px] rounded-[10px] border border-[var(--ld-border)] bg-[var(--ld-bg-2)]">
                  {FREQS.map(f => (
                    <button
                      key={f}
                      onClick={() => setFreq(f)}
                      className={`text-[12.5px] px-[11px] py-[6px] rounded-[7px] transition-all duration-200 cursor-pointer font-[inherit] ${
                        freq === f
                          ? 'font-semibold text-[var(--ld-accent-2)] bg-[var(--ld-accent-soft)] shadow-[inset_0_0_0_1px_var(--ld-accent-line)]'
                          : 'font-medium text-[var(--ld-text-2)] bg-transparent'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time */}
              <div className="flex items-center justify-between gap-[14px] py-[13px] border-t border-[var(--ld-border)]">
                <span className="font-mono text-[11px] tracking-[.1em] text-[var(--ld-text-3)]">TIME</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => stepTime(-30)} aria-label="Earlier" className="w-[30px] h-[30px] rounded-lg border border-[var(--ld-border-strong)] bg-[var(--ld-surface-2)] text-[var(--ld-text-2)] text-[18px] leading-none grid place-items-center cursor-pointer transition-all duration-150 font-[inherit]">−</button>
                  <span className="font-mono text-[17px] font-semibold text-[var(--ld-text)] min-w-[56px] text-center">{fmtTime(mins)}</span>
                  <button onClick={() => stepTime(30)}  aria-label="Later"   className="w-[30px] h-[30px] rounded-lg border border-[var(--ld-border-strong)] bg-[var(--ld-surface-2)] text-[var(--ld-text-2)] text-[18px] leading-none grid place-items-center cursor-pointer transition-all duration-150 font-[inherit]">+</button>
                  <span className="font-mono text-[11px] text-[var(--ld-text-3)] px-[7px] py-[3px] rounded-md border border-[var(--ld-border)]">GMT+4</span>
                </div>
              </div>

              {/* Summary */}
              <div
                className={`flex items-center gap-[9px] mt-[18px] px-[13px] py-[11px] rounded-[11px] font-mono text-[12.5px] font-medium transition-[background,border-color,color] duration-[250ms] ${
                  schedOn
                    ? 'bg-[var(--ld-accent-soft)] border border-[var(--ld-accent-line)] text-[var(--ld-accent-2)]'
                    : 'bg-[var(--ld-surface-2)] border border-[var(--ld-border)] text-[var(--ld-text-3)]'
                }`}
              >
                <span
                  className="w-[7px] h-[7px] rounded-full shrink-0"
                  style={{
                    background: schedOn ? 'var(--ld-accent)' : 'var(--ld-text-3)',
                    boxShadow:  schedOn ? '0 0 0 3px var(--ld-accent-soft)' : 'none',
                  }}
                />
                {summaryText}
              </div>
            </div>

            {/* Email preview */}
            <div className="rounded-[18px] border border-[var(--ld-border)] bg-[var(--ld-surface-2)] p-5">

              {/* Email header */}
              <div className="flex items-center justify-between pb-[14px] border-b border-[var(--ld-border)]">
                <span className="flex items-center gap-[10px] font-semibold text-[14px] text-[var(--ld-text)]">
                  <span className="w-[26px] h-[26px] rounded-[7px] grid place-items-center text-[#04130d] font-extrabold text-[14px]" style={{ background: 'var(--ld-grad)' }}>P</span>
                  PerfScope
                </span>
                <span className="font-mono text-[12px] text-[var(--ld-text-3)]">07:00</span>
              </div>

              <div className="text-[15px] font-semibold text-[var(--ld-text)] mt-[14px] mb-4">Daily report · example.com</div>

              {/* Score row */}
              <div className="flex items-center gap-4 p-[14px] rounded-xl bg-[var(--ld-surface)] border border-[var(--ld-border)]">
                <div className="relative w-[56px] h-[56px] shrink-0">
                  <svg viewBox="0 0 56 56" className="w-[56px] h-[56px]">
                    <circle cx="28" cy="28" r="23" fill="none" stroke="var(--ld-border)" strokeWidth="6"/>
                    <circle cx="28" cy="28" r="23" fill="none" stroke="var(--ld-accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray="144.5" strokeDashoffset="11.6" transform="rotate(-90 28 28)"/>
                  </svg>
                  <b className="absolute inset-0 grid place-items-center font-mono text-[18px] font-semibold text-[var(--ld-accent-2)]">92</b>
                </div>
                <div className="grid gap-[3px]">
                  <span className="inline-flex items-center gap-[6px] font-mono text-[13px] font-semibold text-[var(--ld-accent-2)]">
                    <svg viewBox="0 0 24 24" fill="none" className="w-[14px] h-[14px]"><path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    +3 since yesterday
                  </span>
                  <span className="text-[13px] text-[var(--ld-text-2)]">Performance holding strong</span>
                </div>
              </div>

              {/* Metric rows */}
              <div className="grid gap-[2px] mt-[14px] mb-4">
                {EMAIL_METRICS.map(({ k, v, d, good }) => (
                  <div key={k} className="grid grid-cols-[1fr_auto_auto] gap-[14px] items-center py-[9px] px-[2px] border-b border-[var(--ld-border)] text-[13.5px]">
                    <span className="text-[var(--ld-text-2)]">{k}</span>
                    <b className={`font-mono text-[14px] font-semibold justify-self-end min-w-[56px] text-right ${good ? 'text-[var(--ld-accent-2)]' : 'text-[var(--ld-amber)]'}`}>{v}</b>
                    <span className={`font-mono text-[11.5px] min-w-[52px] text-right ${good ? 'text-[var(--ld-text-3)]' : 'text-[var(--ld-amber)]'}`}>{d}</span>
                  </div>
                ))}
              </div>

              <span className="font-mono text-[13px] font-semibold text-[var(--ld-accent)]">Open full report →</span>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
