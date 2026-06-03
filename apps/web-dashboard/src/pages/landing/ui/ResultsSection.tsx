export function ResultsSection() {
  return (
    <section id="proof" style={{ padding: 'clamp(72px, 11vw, 140px) 0' }}>
      <div className="ld-wrap">
        <div className="reveal" style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto', marginBottom: 'clamp(44px, 6vw, 70px)' }}>
          <span className="ld-eyebrow" style={{ display: 'block', marginBottom: 16 }}>Real results</span>
          <h2 className="ld-h-section" style={{ color: 'var(--ld-text)' }}>Before and after — same page.</h2>
          <p className="ld-lead" style={{ margin: '18px auto 0' }}>
            Teams that apply PerfScope's suggestions usually reach a 90+ score within a single sprint. The example below is a real e-commerce homepage.
          </p>
        </div>

        {/* 3-col grid: baseline | arrow | optimized */}
        <div className="reveal ld-ba-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 18, alignItems: 'center' }}>
          {/* Baseline card */}
          <div style={{ padding: 26, borderRadius: 18, border: '1px solid var(--ld-border)', background: 'var(--ld-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ld-text)', margin: 0 }}>Before PerfScope</h3>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.06em', padding: '4px 10px', borderRadius: 7, fontWeight: 600, color: 'var(--ld-rose)', border: '1px solid rgba(242,100,122,.35)', background: 'rgba(242,100,122,.1)' }}>BASELINE</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 12, alignItems: 'center' }}>
              {/* Gauge */}
              <div>
                <div style={{ position: 'relative', width: 78, height: 78 }}>
                  <svg viewBox="0 0 78 78" style={{ width: 78, height: 78 }}>
                    <circle cx="39" cy="39" r="33" fill="none" stroke="var(--ld-border)" strokeWidth="7"/>
                    <circle cx="39" cy="39" r="33" fill="none" stroke="var(--ld-rose)" strokeWidth="7" strokeLinecap="round" strokeDasharray="207" strokeDashoffset="120"/>
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: "'Geist Mono', monospace", fontSize: 22, fontWeight: 600, color: 'var(--ld-rose)' }}>42</div>
                </div>
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ld-text-3)', marginTop: 6 }}>Performance</div>
              </div>
              {/* Metric boxes */}
              {[{ v: '0.45', l: 'CLS' }, { v: '4.8s', l: 'LCP' }, { v: '820ms', l: 'TBT' }].map(({ v, l }) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ borderRadius: 12, border: '1px solid rgba(242,100,122,.22)', padding: '16px 6px', fontFamily: "'Geist Mono', monospace", fontSize: 20, fontWeight: 600, color: 'var(--ld-rose)', background: 'rgba(242,100,122,.05)' }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--ld-text-3)', marginTop: 6 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Arrow */}
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--ld-grad)', display: 'grid', placeItems: 'center', color: '#04130d', boxShadow: 'var(--ld-glow)', flexShrink: 0 }} className="ld-ba-arrow">
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 20, height: 20 }}>
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Optimized card */}
          <div style={{ padding: 26, borderRadius: 18, border: '1px solid var(--ld-accent-line)', background: 'var(--ld-surface)', boxShadow: '0 0 0 1px var(--ld-accent-soft), 0 20px 60px -34px rgba(20,192,138,.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ld-text)', margin: 0 }}>After PerfScope</h3>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.06em', padding: '4px 10px', borderRadius: 7, fontWeight: 600, color: 'var(--ld-accent-2)', border: '1px solid var(--ld-accent-line)', background: 'var(--ld-accent-soft)' }}>OPTIMIZED</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 12, alignItems: 'center' }}>
              {/* Gauge */}
              <div>
                <div style={{ position: 'relative', width: 78, height: 78 }}>
                  <svg viewBox="0 0 78 78" style={{ width: 78, height: 78 }}>
                    <circle cx="39" cy="39" r="33" fill="none" stroke="var(--ld-border)" strokeWidth="7"/>
                    <circle cx="39" cy="39" r="33" fill="none" stroke="var(--ld-accent)" strokeWidth="7" strokeLinecap="round" strokeDasharray="207" strokeDashoffset="12"/>
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: "'Geist Mono', monospace", fontSize: 22, fontWeight: 600, color: 'var(--ld-accent-2)' }}>94</div>
                </div>
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ld-text-3)', marginTop: 6 }}>Performance</div>
              </div>
              {/* Metric boxes */}
              {[{ v: '0.08', l: 'CLS' }, { v: '1.2s', l: 'LCP' }, { v: '140ms', l: 'TBT' }].map(({ v, l }) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ borderRadius: 12, border: '1px solid rgba(20,192,138,.22)', padding: '16px 6px', fontFamily: "'Geist Mono', monospace", fontSize: 20, fontWeight: 600, color: 'var(--ld-accent-2)', background: 'var(--ld-accent-soft)' }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--ld-text-3)', marginTop: 6 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Delta pills */}
        <div className="reveal" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 38 }}>
          {[
            { color: 'var(--ld-accent-2)', label: 'Performance', value: '+52', icon: <path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> },
            { color: 'var(--ld-teal)', label: 'CLS', value: '−82%', icon: <path d="M3 7l6 6 4-4 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> },
            { color: 'var(--ld-amber)', label: 'LCP', value: '−75%', icon: <path d="M3 7l6 6 4-4 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> },
            { color: 'var(--ld-accent-2)', label: 'TBT', value: '−83%', icon: <path d="M3 7l6 6 4-4 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> },
          ].map(({ color, label, value, icon }) => (
            <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 999, border: '1px solid var(--ld-border)', background: 'var(--ld-surface)', fontSize: 14 }}>
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 15, height: 15, color }}>{icon}</svg>
              <b style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 600, color }}>{value}</b>
              <span style={{ color: 'var(--ld-text-3)', fontSize: 12.5 }}>{label}</span>
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .ld-ba-grid { grid-template-columns: 1fr !important; }
          .ld-ba-arrow { transform: rotate(90deg); margin: 0 auto; }
        }
      `}</style>
    </section>
  );
}
