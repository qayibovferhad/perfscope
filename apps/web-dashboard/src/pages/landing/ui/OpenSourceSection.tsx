export function OpenSourceSection() {
  return (
    <section style={{ padding: 'clamp(72px, 11vw, 140px) 0', paddingBottom: 0 }}>
      <div className="ld-wrap">
        <div
          className="reveal ld-os-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.1fr',
            gap: 'clamp(32px, 5vw, 64px)',
            alignItems: 'center',
            borderRadius: 22,
            border: '1px solid var(--ld-border-strong)',
            background: 'radial-gradient(620px 280px at 12% 0%, var(--ld-accent-soft), transparent 65%), var(--ld-surface)',
            padding: 'clamp(36px, 5vw, 60px)',
          }}
        >
          {/* Left */}
          <div>
            <span className="ld-eyebrow" style={{ display: 'block', marginBottom: 16 }}>Open source</span>
            <h2 style={{ fontSize: 'clamp(28px, 3.8vw, 46px)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1.04, color: 'var(--ld-text)', margin: 0 }}>
              Run it yourself,<br />or help build it.
            </h2>
            <p style={{ color: 'var(--ld-text-2)', fontSize: 16, marginTop: 18, maxWidth: '40ch' }}>
              PerfScope is MIT-licensed and fully open. Self-host it on your own infra, read every line, or send a pull request. Your audits, your data, your call.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
              <a href="#" className="ld-btn ld-btn-primary ld-btn-lg">
                <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
                  <path d="M9 19c-4.5 1.3-4.5-2.2-6-2.6M16 22v-3.6c0-1 .3-1.4 1-2 -3.4-.4-7-1.7-7-7.6 0-1.6.5-2.9 1.4-3.9 -.4-1-.4-2.4.1-3.5 0 0 1.2-.4 3.9 1.4 1.1-.3 2.3-.5 3.5-.5s2.4.2 3.5.5c2.7-1.8 3.9-1.4 3.9-1.4.5 1.1.5 2.5.1 3.5.9 1 1.4 2.3 1.4 3.9 0 5.9-3.6 7.2-7 7.6.5.6 1 1.5 1 3v3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                View on GitHub
              </a>
              <a href="#" className="ld-btn ld-btn-ghost ld-btn-lg">Read the docs</a>
            </div>
          </div>

          {/* Right: terminal mock */}
          <div>
            <div style={{ borderRadius: 16, border: '1px solid var(--ld-border-strong)', background: 'var(--ld-bg)', overflow: 'hidden', boxShadow: 'var(--ld-shadow-card)' }}>
              {/* Title bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: '1px solid var(--ld-border)', background: 'var(--ld-surface-2)' }}>
                <span style={{ display: 'flex', gap: 6 }}>
                  {[0,1,2].map(i => <i key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ld-border-strong)', display: 'block' }} />)}
                </span>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ld-text-3)' }}>~/perfscope</span>
              </div>
              {/* Body */}
              <div style={{ padding: 18, display: 'grid', gap: 7, fontFamily: "'Geist Mono', monospace", fontSize: 13, lineHeight: 1.5 }}>
                <p style={{ color: 'var(--ld-text)', margin: 0 }}>
                  <span style={{ color: 'var(--ld-accent)', marginRight: 8 }}>$</span>
                  npx perfscope audit example.com
                </p>
                <p style={{ color: 'var(--ld-text-3)', margin: 0 }}>✔ Lighthouse run complete</p>
                <p style={{ color: 'var(--ld-text-3)', margin: 0 }}>
                  {'  '}Performance{' '}
                  <span style={{ color: 'var(--ld-accent-2)' }}>94</span>
                  {' · '}LCP{' '}
                  <span style={{ color: 'var(--ld-accent-2)' }}>1.2s</span>
                  {' · '}CLS{' '}
                  <span style={{ color: 'var(--ld-accent-2)' }}>0.04</span>
                </p>
                <p style={{ color: 'var(--ld-text)', margin: 0 }}>
                  <span style={{ color: 'var(--ld-accent)', marginRight: 8 }}>$</span>
                  <span className="ld-cursor">git clone perfscope/perfscope</span>
                </p>
              </div>
              {/* Stats footer */}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: '14px 18px', borderTop: '1px solid var(--ld-border)', background: 'var(--ld-surface-2)' }}>
                {[
                  {
                    icon: <svg viewBox="0 0 24 24" fill="none" style={{ width: 15, height: 15, color: 'var(--ld-accent)' }}><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.9 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
                    val: '4.2k', label: 'stars',
                  },
                  {
                    icon: <svg viewBox="0 0 24 24" fill="none" style={{ width: 15, height: 15, color: 'var(--ld-accent)' }}><circle cx="6" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.6"/><circle cx="6" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.6"/><circle cx="18" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.6"/><path d="M6 8.4v7.2M8.2 7.2C12 7.2 18 7 18 10.4" stroke="currentColor" strokeWidth="1.6"/></svg>,
                    val: '380', label: 'forks',
                  },
                  {
                    icon: <svg viewBox="0 0 24 24" fill="none" style={{ width: 15, height: 15, color: 'var(--ld-accent)' }}><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/></svg>,
                    val: 'MIT', label: 'license',
                  },
                ].map(({ icon, val, label }) => (
                  <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: 'var(--ld-text-2)' }}>
                    {icon}
                    <b style={{ color: 'var(--ld-text)', fontWeight: 600 }}>{val}</b>
                    {' '}{label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) { .ld-os-grid { grid-template-columns: 1fr !important; gap: 32px !important; } }
      `}</style>
    </section>
  );
}
