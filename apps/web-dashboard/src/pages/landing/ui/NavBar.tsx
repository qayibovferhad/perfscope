import { useState, useEffect } from 'react';

export function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('perfscope-theme');
    const initial = saved === 'light' ? 'light' : 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);

    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('perfscope-theme', next); } catch (_) {}
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        background: 'color-mix(in oklab, var(--ld-bg) 72%, transparent)',
        borderBottom: scrolled ? '1px solid var(--ld-border)' : '1px solid transparent',
        transition: 'border-color .3s, background .3s',
      }}
    >
      <div className="ld-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, gap: 24 }}>
        {/* Brand */}
        <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 17, letterSpacing: '-.02em', color: 'var(--ld-text)', textDecoration: 'none' }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--ld-grad)', boxShadow: 'var(--ld-glow)', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 17, height: 17 }}>
              <path d="M3 12h3l2.5-7 4 14 3-9 2 2H21" stroke="#04130d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span>Perf<b style={{ color: 'var(--ld-accent-2)', fontWeight: 800 }}>Scope</b></span>
        </a>

        {/* Nav links — hidden below 760px */}
        <nav style={{ display: 'flex', gap: 4, alignItems: 'center' }} className="ld-nav-links">
          {[
            { href: '#how', label: 'How it works' },
            { href: '#features', label: 'Features' },
            { href: '#proof', label: 'Results' },
            { href: '#faq', label: 'FAQ' },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              style={{ fontSize: 14.5, color: 'var(--ld-text-2)', padding: '8px 13px', borderRadius: 9, fontWeight: 500, transition: 'color .2s, background .2s', textDecoration: 'none' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ld-text)'; (e.currentTarget as HTMLElement).style.background = 'var(--ld-surface-hover)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ld-text-2)'; (e.currentTarget as HTMLElement).style.background = ''; }}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', border: '1px solid var(--ld-border)', color: 'var(--ld-text-2)', background: 'var(--ld-surface)', cursor: 'pointer', transition: 'all .2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ld-text)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--ld-border-strong)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ld-text-2)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--ld-border)'; }}
          >
            {/* Moon icon (dark mode active) */}
            <svg className="ic-moon" viewBox="0 0 24 24" fill="none" style={{ width: 17, height: 17 }}>
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
            {/* Sun icon (light mode active) */}
            <svg className="ic-sun" viewBox="0 0 24 24" fill="none" style={{ width: 17, height: 17 }}>
              <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M12 2v2.4M12 19.6V22M4.5 4.5l1.7 1.7M17.8 17.8l1.7 1.7M2 12h2.4M19.6 12H22M4.5 19.5l1.7-1.7M17.8 6.2l1.7-1.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          <a
            href="#top"
            className="ld-btn ld-btn-primary"
            style={{ fontSize: 14.5 }}
          >
            Start audit
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .ld-nav-links { display: none !important; }
        }
      `}</style>
    </header>
  );
}
