export function WhySection() {
  return (
    <section style={{ borderBlock: '1px solid var(--ld-border)', background: 'var(--ld-bg-2)', padding: 'clamp(64px, 9vw, 110px) 0' }}>
      <div className="ld-wrap">
        <div style={{
          display: 'grid',
          gridTemplateColumns: '0.92fr 1.08fr',
          gap: 'clamp(36px, 6vw, 80px)',
          alignItems: 'center',
        }} className="ld-why-grid">

          {/* Left */}
          <div className="reveal">
            <span className="ld-eyebrow" style={{ display: 'block', marginBottom: 18 }}>Why it matters</span>
            <h2 style={{ fontSize: 'clamp(28px, 3.6vw, 44px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.04, color: 'var(--ld-text)' }}>
              A slow page isn't a bug report.<br />It's a quiet leak.
            </h2>
            <p style={{ color: 'var(--ld-text-2)', fontSize: 'clamp(15px, 1.4vw, 17.5px)', marginTop: 20, maxWidth: '46ch' }}>
              Nobody files a ticket because a page felt sluggish — they just leave, and you never hear about it. Speed is the part of the product your visitors feel before they read a single word. Here's what's actually at stake.
            </p>
            <a
              href="#proof"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 26, fontWeight: 600, fontSize: 15, color: 'var(--ld-accent)', transition: 'gap .2s', textDecoration: 'none' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.gap = '13px'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.gap = '8px'; }}
            >
              See a real before &amp; after
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 17, height: 17 }}>
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>

          {/* Right: stat cards */}
          <div style={{ display: 'grid', gap: 14 }}>
            {[
              { num: '53', unit: '%', copy: 'of people abandon a mobile visit when a page takes longer than three seconds to load.', src: 'Google / SOASTA mobile research', accent: false },
              { num: '7', unit: '%', copy: 'drop in conversions can follow from just one tenth of a second of extra delay at checkout.', src: 'Akamai performance study', accent: false },
              { num: '3', unit: '', copy: 'Core Web Vitals — LCP, INP and CLS — feed directly into how Google ranks your page.', src: 'Google Search ranking signals', accent: true },
            ].map(({ num, unit, copy, src, accent }) => (
              <div
                key={num}
                className="reveal"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: '6px 22px',
                  alignItems: 'baseline',
                  padding: '24px 26px',
                  borderRadius: 16,
                  border: '1px solid var(--ld-border)',
                  background: 'var(--ld-surface)',
                  transition: 'border-color .25s, transform .25s, background .25s',
                  cursor: 'default',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'var(--ld-accent-line)';
                  el.style.transform = 'translateX(4px)';
                  el.style.background = 'var(--ld-surface-2)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'var(--ld-border)';
                  el.style.transform = '';
                  el.style.background = 'var(--ld-surface)';
                }}
              >
                <div style={{ gridRow: 'span 2' }}>
                  <b style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 'clamp(40px, 5vw, 56px)',
                    fontWeight: 600,
                    lineHeight: .9,
                    letterSpacing: '-.04em',
                    color: accent ? 'var(--ld-accent-2)' : 'var(--ld-text)',
                    display: 'inline-flex',
                    alignItems: 'flex-start',
                  }}>
                    {num}
                    {unit && <i style={{ fontStyle: 'normal', fontSize: '.5em', color: 'var(--ld-text-3)', marginTop: '.25em', marginLeft: 1 }}>{unit}</i>}
                  </b>
                </div>
                <p style={{ color: 'var(--ld-text)', fontSize: 15, lineHeight: 1.5, alignSelf: 'center', margin: 0 }}>{copy}</p>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, letterSpacing: '.04em', color: 'var(--ld-text-3)', gridColumn: 2 }}>{src}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .ld-why-grid { grid-template-columns: 1fr !important; gap: 36px !important; }
        }
      `}</style>
    </section>
  );
}
