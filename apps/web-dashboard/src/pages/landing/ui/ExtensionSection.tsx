export function ExtensionSection() {
  return (
    <section id="extension" style={{ background: 'var(--ld-bg-2)', borderBlock: '1px solid var(--ld-border)', padding: 'clamp(72px, 11vw, 140px) 0' }}>
      <div className="ld-wrap">
        <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 'clamp(36px, 6vw, 72px)', alignItems: 'center' }} className="ld-ext-grid">

          {/* Left: browser mock */}
          <div className="reveal">
            <div style={{ borderRadius: 16, border: '1px solid var(--ld-border-strong)', background: 'var(--ld-surface)', boxShadow: 'var(--ld-shadow-card)', overflow: 'hidden' }}>
              {/* Browser title bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: '1px solid var(--ld-border)', background: 'var(--ld-surface-2)' }}>
                <span style={{ display: 'flex', gap: 6 }}>
                  {[0,1,2].map(i => <i key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ld-border-strong)', display: 'block' }} />)}
                </span>
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: 'var(--ld-text-2)', padding: '7px 12px', borderRadius: 8, background: 'var(--ld-bg-2)', border: '1px solid var(--ld-border)' }}>
                  <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14, color: 'var(--ld-text-3)' }}>
                    <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6"/>
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6"/>
                  </svg>
                  anywebsite.com
                </span>
                <span style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--ld-grad)', boxShadow: 'var(--ld-glow)', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
                    <path d="M3 12h3l2.5-7 4 14 3-9 2 2H21" stroke="#04130d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </div>

              {/* Browser body */}
              <div style={{ position: 'relative', padding: 22, minHeight: 300 }}>
                {/* Faux page */}
                <div style={{ display: 'grid', gap: 14, opacity: .5 }}>
                  {(['70%','90%','50%'] as const).map((w, i) => (
                    <div key={i} style={{ height: 11, borderRadius: 5, background: 'var(--ld-surface-hover)', width: w }} />
                  ))}
                  <div style={{ height: 90, borderRadius: 12, background: 'var(--ld-surface-hover)', margin: '4px 0' }} />
                  {(['80%','40%'] as const).map((w, i) => (
                    <div key={i} style={{ height: 11, borderRadius: 5, background: 'var(--ld-surface-hover)', width: w }} />
                  ))}
                </div>

                {/* Extension popup */}
                <div style={{ position: 'absolute', top: 16, right: 16, width: 250, borderRadius: 14, border: '1px solid var(--ld-border-strong)', background: 'var(--ld-surface)', boxShadow: '0 24px 60px -20px rgba(0,0,0,.6), var(--ld-glow)', padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 600, marginBottom: 14, color: 'var(--ld-text)' }}>
                    <span>PerfScope</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--ld-accent-2)', fontWeight: 600 }}>
                      <span className="ld-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                      this tab
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
                      <svg viewBox="0 0 56 56" style={{ width: 56, height: 56 }}>
                        <circle cx="28" cy="28" r="23" fill="none" stroke="var(--ld-border)" strokeWidth="6"/>
                        <circle cx="28" cy="28" r="23" fill="none" stroke="var(--ld-accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray="144.5" strokeDashoffset="24.5" transform="rotate(-90 28 28)"/>
                      </svg>
                      <b style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: "'Geist Mono', monospace", fontSize: 18, fontWeight: 600, color: 'var(--ld-accent-2)' }}>83</b>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        { t: 'LCP 1.4s', cls: 'good' },
                        { t: 'CLS 0.05', cls: 'good' },
                        { t: 'TBT 240ms', cls: 'warn' },
                      ].map(({ t, cls }) => (
                        <span key={t} style={{
                          fontFamily: "'Geist Mono', monospace", fontSize: 10.5, padding: '4px 8px', borderRadius: 7, fontWeight: 600,
                          color: cls === 'good' ? 'var(--ld-accent-2)' : 'var(--ld-amber)',
                          border: `1px solid ${cls === 'good' ? 'rgba(20,192,138,.25)' : 'rgba(230,162,60,.3)'}`,
                          background: cls === 'good' ? 'var(--ld-accent-soft)' : 'rgba(230,162,60,.1)',
                        }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--ld-border)', fontFamily: "'Geist Mono', monospace", fontSize: 11.5, color: 'var(--ld-text-3)' }}>
                    <span>Compare with</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px', borderRadius: 8, border: '1px solid var(--ld-border-strong)', background: 'var(--ld-bg-2)', color: 'var(--ld-text)', fontSize: 11.5, fontWeight: 600 }}>
                      my-store.com
                      <svg viewBox="0 0 24 24" fill="none" style={{ width: 13, height: 13, color: 'var(--ld-text-3)' }}>
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <div style={{ display: 'grid', gap: 2, textAlign: 'center', padding: '10px 6px', borderRadius: 10, border: '1px solid var(--ld-border)', background: 'var(--ld-surface-2)' }}>
                      <b style={{ fontFamily: "'Geist Mono', monospace", fontSize: 22, fontWeight: 600, color: 'var(--ld-text-2)' }}>83</b>
                      <span style={{ fontSize: 10, color: 'var(--ld-text-3)' }}>this tab</span>
                    </div>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ld-text-3)' }}>vs</span>
                    <div style={{ display: 'grid', gap: 2, textAlign: 'center', padding: '10px 6px', borderRadius: 10, border: '1px solid var(--ld-accent-line)', background: 'var(--ld-accent-soft)' }}>
                      <b style={{ fontFamily: "'Geist Mono', monospace", fontSize: 22, fontWeight: 600, color: 'var(--ld-accent-2)' }}>95</b>
                      <span style={{ fontSize: 10, color: 'var(--ld-text-3)' }}>my-store.com</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: copy */}
          <div className="reveal">
            <span className="ld-eyebrow" style={{ display: 'block', marginBottom: 16 }}>Browser extension</span>
            <h2 className="ld-h-section" style={{ color: 'var(--ld-text)' }}>Audit any page you're standing on.</h2>
            <p className="ld-lead" style={{ marginTop: 18 }}>
              Pin PerfScope to your toolbar and the whole web becomes auditable. Land on a competitor, a client's site, or a random page that feels slow — one click runs a full check on the tab you're already looking at.
            </p>
            <ul style={{ listStyle: 'none', display: 'grid', gap: 16, marginTop: 28, padding: 0 }}>
              {[
                {
                  icon: <svg viewBox="0 0 24 24" fill="none"><path d="M13 2 4 13h6l-1 9 9-12h-6l1-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
                  b: 'One click, current tab.',
                  txt: 'Score and Core Web Vitals for whatever page is open — instantly, in place.',
                },
                {
                  icon: <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18M5 7l-3 5 3 3M19 7l3 5-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                  b: 'Compare against your sites.',
                  txt: "Stack the page you're on next to any project you've saved and see who wins, metric by metric.",
                },
                {
                  icon: <svg viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                  b: 'Saved automatically.',
                  txt: 'Every quick audit lands in your history, so the page you checked on Tuesday is still there on Friday.',
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
            <a href="#" className="ld-btn ld-btn-primary ld-btn-lg" style={{ marginTop: 28, display: 'inline-flex' }}>
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
                <path d="M12 2 3 6v6c0 5 3.8 8.5 9 10 5.2-1.5 9-5 9-10V6l-9-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              </svg>
              Add to your browser
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) { .ld-ext-grid { grid-template-columns: 1fr !important; gap: 40px !important; } }
      `}</style>
    </section>
  );
}
