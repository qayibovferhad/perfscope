const features = [
  {
    tag: 'Core',
    title: 'Full performance audit',
    desc: 'Deep scans with an industry-standard engine. Complex web metrics turn into one score you can actually read.',
    bullets: ['Core Web Vitals (LCP, INP, CLS) tracking', 'Real-world user environment simulation', 'Separate mobile and desktop tests', 'Detailed "Time to Interactive" analysis'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>
    ),
  },
  {
    tag: 'Compete',
    title: 'Benchmark against rivals',
    desc: 'Run a side-by-side audit on any live URL. Compare speed, SEO and quality scores against your competition.',
    bullets: ['Direct competitor URL comparison', 'Industry speed ranking', 'See your advantages and gaps', 'Share the comparison result'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M3 12h18M12 3c2.6 2.5 2.6 15.5 0 18M12 3c-2.6 2.5-2.6 15.5 0 18" stroke="currentColor" strokeWidth="1.4"/></svg>
    ),
  },
  {
    tag: 'Diff',
    title: 'Compare your own audits',
    desc: 'Did the last deploy actually help? Pick any two of your own audits and see the exact difference in metrics.',
    bullets: ['Visual "diff" of scores', 'Metric-by-metric delta (+/−)', 'Side-by-side filmstrip comparison', 'Asset-level regression detection'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18M5 7l-3 5 3 3M19 7l3 5-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ),
  },
  {
    tag: 'History',
    title: 'Regression & history tracking',
    desc: 'Track how every code change affects performance. A permanent audit log surfaces speed drops the moment they happen.',
    bullets: ['Unlimited historical audit storage', 'Trend chart over time', 'A snapshot for every release', 'Automatic alerts on degradation'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none"><path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M7 14l3.5-3.5 3 3L21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ),
  },
  {
    tag: 'Live',
    title: 'Live updates',
    desc: 'No need to refresh. The moment an audit finishes, the result lands across every open panel instantly.',
    bullets: ['Real-time result streaming', 'Cross-tab synchronization', 'Status tracking for active audits', 'Zero-latency reporting dashboard'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none"><path d="M13 2 4 13h6l-1 9 9-12h-6l1-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
    ),
  },
  {
    tag: 'Quality',
    title: 'Accessibility & SEO',
    desc: 'Make your page both visible and open to everyone. Check it against modern accessibility standards and SEO best practices.',
    bullets: ['A11y (accessibility) compliance checks', 'SEO structure and meta validation', 'Industry quality scoring', 'Full quality report you can share'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 2 3 6v6c0 5 3.8 8.5 9 10 5.2-1.5 9-5 9-10V6l-9-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ),
  },
];

export function FeaturesSection() {
  return (
    <section id="features" style={{ background: 'var(--ld-bg-2)', borderBlock: '1px solid var(--ld-border)', padding: 'clamp(72px, 11vw, 140px) 0' }}>
      <div className="ld-wrap">
        <div className="reveal" style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto', marginBottom: 'clamp(44px, 6vw, 70px)' }}>
          <span className="ld-eyebrow" style={{ display: 'block', marginBottom: 16 }}>Features</span>
          <h2 className="ld-h-section" style={{ color: 'var(--ld-text)' }}>Everything you need to ship fast, stable pages.</h2>
          <p className="ld-lead" style={{ margin: '18px auto 0' }}>
            From raw Lighthouse scores to frame-level CLS inspection, network waterfalls, and instant fixes — one tool, complete visibility.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }} className="ld-feat-grid">
          {features.map(feat => (
            <div
              key={feat.tag}
              className="reveal"
              style={{
                padding: 26, borderRadius: 16, border: '1px solid var(--ld-border)', background: 'var(--ld-surface)',
                transition: 'border-color .25s, transform .25s, background .25s',
                cursor: 'default',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = 'var(--ld-accent-line)';
                el.style.transform = 'translateY(-3px)';
                el.style.background = 'var(--ld-surface-2)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = 'var(--ld-border)';
                el.style.transform = '';
                el.style.background = 'var(--ld-surface)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', border: '1px solid var(--ld-border-strong)', background: 'var(--ld-surface-2)', color: 'var(--ld-accent)' }}>
                  {feat.icon}
                </div>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.06em', padding: '4px 9px', borderRadius: 7, border: '1px solid var(--ld-border)', color: 'var(--ld-text-3)' }}>{feat.tag}</span>
              </div>
              <h3 style={{ fontSize: 19, marginBottom: 10, fontWeight: 700, color: 'var(--ld-text)' }}>{feat.title}</h3>
              <p style={{ color: 'var(--ld-text-2)', fontSize: 14.5, marginBottom: 18 }}>{feat.desc}</p>
              <ul style={{ listStyle: 'none', display: 'grid', gap: 9, padding: 0, margin: 0 }}>
                {feat.bullets.map(b => (
                  <li key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13.5, color: 'var(--ld-text-2)' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ld-accent)', marginTop: 7, flexShrink: 0, display: 'block' }} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) { .ld-feat-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 760px) { .ld-feat-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}
