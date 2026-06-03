export function FooterSection() {
  return (
    <footer style={{ borderTop: '1px solid var(--ld-border)', padding: '56px 0 40px' }}>
      <div className="ld-wrap">
        {/* Top grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 32, marginBottom: 44 }} className="ld-foot-top">
          {/* Brand */}
          <div>
            <a href="#top" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 17, letterSpacing: '-.02em', color: 'var(--ld-text)', textDecoration: 'none', marginBottom: 0 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--ld-grad)', boxShadow: 'var(--ld-glow)', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" style={{ width: 17, height: 17 }}>
                  <path d="M3 12h3l2.5-7 4 14 3-9 2 2H21" stroke="#04130d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span>Perf<b style={{ color: 'var(--ld-accent-2)', fontWeight: 800 }}>Scope</b></span>
            </a>
            <p style={{ color: 'var(--ld-text-2)', fontSize: 14, marginTop: 14, maxWidth: '30ch', margin: '14px 0 0' }}>
              An open-source tool that makes Lighthouse audits visible, trackable and fixable.
            </p>
          </div>

          {/* Columns */}
          {[
            { heading: 'Product', links: [{ l: 'Features', h: '#features' }, { l: 'How it works', h: '#how' }, { l: 'Results', h: '#proof' }, { l: 'FAQ', h: '#faq' }] },
            { heading: 'Resources', links: [{ l: 'Docs', h: '#' }, { l: 'Core Web Vitals guide', h: '#' }, { l: 'Changelog', h: '#' }, { l: 'Status', h: '#' }] },
            { heading: 'Project', links: [{ l: 'GitHub', h: '#' }, { l: 'License (MIT)', h: '#' }, { l: 'Contribute', h: '#' }, { l: 'Contact', h: '#' }] },
          ].map(({ heading, links }) => (
            <div key={heading}>
              <h4 style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ld-text-3)', marginBottom: 16, fontWeight: 600 }}>{heading}</h4>
              {links.map(({ l, h }) => (
                <a
                  key={l}
                  href={h}
                  style={{ display: 'block', color: 'var(--ld-text-2)', fontSize: 14, padding: '5px 0', textDecoration: 'none', transition: 'color .2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ld-accent)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ld-text-2)'; }}
                >
                  {l}
                </a>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 26, borderTop: '1px solid var(--ld-border)', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: 'var(--ld-text-3)' }}>© 2026 PerfScope · MIT License</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'GitHub', icon: <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}><path d="M9 19c-4.5 1.3-4.5-2.2-6-2.6M16 22v-3.6c0-1 .3-1.4 1-2 -3.4-.4-7-1.7-7-7.6 0-1.6.5-2.9 1.4-3.9 -.4-1-.4-2.4.1-3.5 0 0 1.2-.4 3.9 1.4 1.1-.3 2.3-.5 3.5-.5s2.4.2 3.5.5c2.7-1.8 3.9-1.4 3.9-1.4.5 1.1.5 2.5.1 3.5.9 1 1.4 2.3 1.4 3.9 0 5.9-3.6 7.2-7 7.6.5.6 1 1.5 1 3v3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
              { label: 'X', icon: <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}><path d="M4 4l16 16M20 4L4 20" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg> },
            ].map(({ label, icon }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                style={{ width: 36, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center', border: '1px solid var(--ld-border)', color: 'var(--ld-text-2)', transition: 'all .2s', textDecoration: 'none' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--ld-accent)'; el.style.borderColor = 'var(--ld-accent-line)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--ld-text-2)'; el.style.borderColor = 'var(--ld-border)'; }}
              >
                {icon}
              </a>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) { .ld-foot-top { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 480px) { .ld-foot-top { grid-template-columns: 1fr !important; } }
      `}</style>
    </footer>
  );
}
