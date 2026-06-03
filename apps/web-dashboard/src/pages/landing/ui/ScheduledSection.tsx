import { useState } from 'react';

type Freq = 'Daily' | 'Weekdays' | 'Weekly';

function fmtTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

function nextWord(freq: Freq) {
  if (freq === 'Weekly') return 'Monday';
  if (freq === 'Weekdays') return 'the next weekday';
  return 'tomorrow';
}

export function ScheduledSection() {
  const [schedOn, setSchedOn] = useState(true);
  const [freq, setFreq] = useState<Freq>('Daily');
  const [mins, setMins] = useState(7 * 60);

  function stepTime(delta: number) {
    setMins(prev => (prev + delta + 1440) % 1440);
  }

  const summaryText = schedOn
    ? `Next report — ${nextWord(freq)} at ${fmtTime(mins)}`
    : 'Daily report is paused';

  return (
    <section style={{ padding: 'clamp(72px, 11vw, 140px) 0' }} id="reports">
      <div className="ld-wrap">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(36px, 6vw, 76px)', alignItems: 'center' }} className="ld-sched-grid">

          {/* Left */}
          <div className="reveal">
            <span className="ld-eyebrow" style={{ display: 'block', marginBottom: 16 }}>Set it and forget it</span>
            <h2 className="ld-h-section" style={{ color: 'var(--ld-text)' }}>Wake up to a report.<br />Without opening a tab.</h2>
            <p className="ld-lead" style={{ marginTop: 20 }}>
              Pick a time once. Every day, PerfScope audits your pages on its own and drops a clean summary in your inbox — what changed, what slipped, what to fix.
            </p>
            <ul style={{ listStyle: 'none', display: 'grid', gap: 18, marginTop: 30, padding: 0 }}>
              {[
                {
                  icon: <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                  b: 'Your time, your timezone.',
                  txt: 'Daily, weekdays, or weekly — whatever rhythm fits your team.',
                },
                {
                  icon: <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18M5 7l-3 5 3 3M19 7l3 5-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                  b: 'Always a comparison.',
                  txt: 'Each report diffs against yesterday, so a regression jumps out instead of hiding in a number.',
                },
                {
                  icon: <svg viewBox="0 0 24 24" fill="none"><path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7"/></svg>,
                  b: 'Email, Slack or both.',
                  txt: 'Send it to a person or a channel. Quiet on good days, loud when a score drops.',
                },
              ].map(({ icon, b, txt }) => (
                <li key={b} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, display: 'grid', placeItems: 'center', border: '1px solid var(--ld-border-strong)', background: 'var(--ld-surface-2)', color: 'var(--ld-accent)' }}>
                    {icon}
                  </span>
                  <div style={{ fontSize: 14.5, color: 'var(--ld-text-2)', lineHeight: 1.5 }}>
                    <b style={{ color: 'var(--ld-text)', fontWeight: 600 }}>{b}</b> {txt}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: scheduler + email preview */}
          <div className="reveal" style={{ display: 'grid', gap: 16 }}>
            {/* Scheduler card */}
            <div style={{ borderRadius: 18, border: '1px solid var(--ld-border-strong)', background: 'var(--ld-surface)', boxShadow: 'var(--ld-shadow-card)', padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: 'var(--ld-text-2)', letterSpacing: '.04em' }}>Daily report</span>
                {/* Toggle */}
                <label style={{ position: 'relative', display: 'inline-flex', cursor: 'pointer' }}>
                  <input type="checkbox" checked={schedOn} onChange={e => setSchedOn(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                  <span style={{
                    width: 42, height: 24, borderRadius: 999,
                    background: schedOn ? 'var(--ld-accent-soft)' : 'var(--ld-surface-hover)',
                    border: `1px solid ${schedOn ? 'var(--ld-accent-line)' : 'var(--ld-border-strong)'}`,
                    display: 'block', transition: 'background .25s, border-color .25s',
                  }}>
                    <span style={{
                      position: 'absolute', top: 4, left: schedOn ? 22 : 4, width: 16, height: 16, borderRadius: '50%',
                      background: schedOn ? 'var(--ld-accent)' : 'var(--ld-text-3)',
                      transition: 'left .25s, background .25s',
                    }} />
                  </span>
                </label>
              </div>

              {/* Frequency row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '13px 0', borderTop: '1px solid var(--ld-border)' }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, letterSpacing: '.1em', color: 'var(--ld-text-3)' }}>FREQUENCY</span>
                <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, border: '1px solid var(--ld-border)', background: 'var(--ld-bg-2)' }}>
                  {(['Daily', 'Weekdays', 'Weekly'] as Freq[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setFreq(f)}
                      style={{
                        fontSize: 12.5, fontWeight: freq === f ? 600 : 500,
                        color: freq === f ? 'var(--ld-accent-2)' : 'var(--ld-text-2)',
                        padding: '6px 11px', borderRadius: 7,
                        background: freq === f ? 'var(--ld-accent-soft)' : 'transparent',
                        boxShadow: freq === f ? 'inset 0 0 0 1px var(--ld-accent-line)' : '',
                        transition: 'all .2s', cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '13px 0', borderTop: '1px solid var(--ld-border)' }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, letterSpacing: '.1em', color: 'var(--ld-text-3)' }}>TIME</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => stepTime(-30)} aria-label="Earlier" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--ld-border-strong)', background: 'var(--ld-surface-2)', color: 'var(--ld-text-2)', fontSize: 18, lineHeight: 1, display: 'grid', placeItems: 'center', cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit' }}>−</button>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 17, fontWeight: 600, color: 'var(--ld-text)', minWidth: 56, textAlign: 'center' }}>{fmtTime(mins)}</span>
                  <button onClick={() => stepTime(30)} aria-label="Later" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--ld-border-strong)', background: 'var(--ld-surface-2)', color: 'var(--ld-text-2)', fontSize: 18, lineHeight: 1, display: 'grid', placeItems: 'center', cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit' }}>+</button>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ld-text-3)', padding: '3px 7px', borderRadius: 6, border: '1px solid var(--ld-border)' }}>GMT+4</span>
                </div>
              </div>

              {/* Footer summary */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9, marginTop: 18, padding: '11px 13px',
                borderRadius: 11,
                background: schedOn ? 'var(--ld-accent-soft)' : 'var(--ld-surface-2)',
                border: `1px solid ${schedOn ? 'var(--ld-accent-line)' : 'var(--ld-border)'}`,
                fontFamily: "'Geist Mono', monospace", fontSize: 12.5,
                color: schedOn ? 'var(--ld-accent-2)' : 'var(--ld-text-3)', fontWeight: 500,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: schedOn ? 'var(--ld-accent)' : 'var(--ld-text-3)', boxShadow: schedOn ? '0 0 0 3px var(--ld-accent-soft)' : 'none', flexShrink: 0 }} />
                {summaryText}
              </div>
            </div>

            {/* Email preview */}
            <div style={{ borderRadius: 18, border: '1px solid var(--ld-border)', background: 'var(--ld-surface-2)', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid var(--ld-border)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 14, color: 'var(--ld-text)' }}>
                  <span style={{ width: 26, height: 26, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'var(--ld-grad)', color: '#04130d', fontWeight: 800, fontSize: 14 }}>P</span>
                  PerfScope
                </span>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ld-text-3)' }}>07:00</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ld-text)', margin: '14px 0 16px' }}>Daily report · example.com</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 14, borderRadius: 12, background: 'var(--ld-surface)', border: '1px solid var(--ld-border)' }}>
                <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
                  <svg viewBox="0 0 56 56" style={{ width: 56, height: 56 }}>
                    <circle cx="28" cy="28" r="23" fill="none" stroke="var(--ld-border)" strokeWidth="6"/>
                    <circle cx="28" cy="28" r="23" fill="none" stroke="var(--ld-accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray="144.5" strokeDashoffset="11.6" transform="rotate(-90 28 28)"/>
                  </svg>
                  <b style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: "'Geist Mono', monospace", fontSize: 18, fontWeight: 600, color: 'var(--ld-accent-2)' }}>92</b>
                </div>
                <div style={{ display: 'grid', gap: 3 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 600, color: 'var(--ld-accent-2)' }}>
                    <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}><path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    +3 since yesterday
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--ld-text-2)' }}>Performance holding strong</span>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 2, margin: '14px 0 16px' }}>
                {[
                  { k: 'LCP', v: '1.1s', d: '−0.1s', cls: 'good' },
                  { k: 'CLS', v: '0.03', d: 'steady', cls: 'good' },
                  { k: 'TBT', v: '180ms', d: '+20ms', cls: 'warn' },
                ].map(({ k, v, d, cls }) => (
                  <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 14, alignItems: 'center', padding: '9px 2px', borderBottom: '1px solid var(--ld-border)', fontSize: 13.5 }}>
                    <span style={{ color: 'var(--ld-text-2)' }}>{k}</span>
                    <b style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14, fontWeight: 600, color: cls === 'good' ? 'var(--ld-accent-2)' : 'var(--ld-amber)', justifySelf: 'end', minWidth: 56, textAlign: 'right' }}>{v}</b>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11.5, minWidth: 52, textAlign: 'right', color: cls === 'good' ? 'var(--ld-text-3)' : 'var(--ld-amber)' }}>{d}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 600, color: 'var(--ld-accent)' }}>Open full report →</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) { .ld-sched-grid { grid-template-columns: 1fr !important; gap: 40px !important; } }
      `}</style>
    </section>
  );
}
