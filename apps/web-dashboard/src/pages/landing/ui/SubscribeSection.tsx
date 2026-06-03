import { useState, useRef } from 'react';

export function SubscribeSection() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const fieldRef = useRef<HTMLLabelElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!ok) {
      setInvalid(true);
      setTimeout(() => setInvalid(false), 1400);
      return;
    }
    setDone(true);
  }

  return (
    <section style={{ padding: 'clamp(56px, 8vw, 96px) 0' }}>
      <div className="ld-wrap">
        <div
          className="reveal"
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: 'clamp(20px, 3vw, 40px)',
            alignItems: 'center',
            borderRadius: 22,
            background: 'var(--ld-grad)',
            color: '#04130d',
            padding: 'clamp(30px, 4vw, 46px) clamp(28px, 4vw, 52px)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 24px 70px -28px rgba(20,192,138,.55)',
          }}
          className="reveal ld-sub-grid"
        >
          {/* Decorative circle */}
          <div style={{ position: 'absolute', right: -60, top: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,.16)', pointerEvents: 'none' }} />

          {/* Mail glyph */}
          <div style={{ width: 56, height: 56, borderRadius: 15, display: 'grid', placeItems: 'center', background: 'rgba(4,19,13,.14)', color: '#04130d', position: 'relative', zIndex: 1, flexShrink: 0 }} className="ld-sub-glyph">
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 27, height: 27 }}>
              <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7"/>
            </svg>
          </div>

          {/* Text block */}
          <div style={{ position: 'relative', zIndex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11.5, letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 600, opacity: .7 }}>Stay in the loop</span>
            <h2 style={{ fontSize: 'clamp(22px, 2.6vw, 32px)', fontWeight: 800, letterSpacing: '-.025em', margin: '8px 0', lineHeight: 1.1, color: '#04130d' }}>
              Be first to know when a feature ships.
            </h2>
            <p style={{ fontSize: 14.5, maxWidth: '50ch', color: 'rgba(4,19,13,.72)', margin: 0 }}>
              Regression alerts, CI integrations and new audit capabilities. No spam — one or two notes a month.
            </p>
          </div>

          {/* Action block */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {!done ? (
              <>
                <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', gap: 9 }} className="ld-notify-form">
                  <label
                    ref={fieldRef}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px',
                      borderRadius: 12, background: 'rgba(255,255,255,.92)',
                      border: `1px solid ${invalid ? 'var(--ld-rose)' : 'transparent'}`,
                      boxShadow: invalid ? '0 0 0 4px rgba(242,100,122,.14)' : 'none',
                      transition: 'box-shadow .2s, border-color .2s', minWidth: 200,
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" style={{ width: 17, height: 17, color: '#0c8f66', flexShrink: 0 }}>
                      <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7"/>
                    </svg>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      autoComplete="email"
                      style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#04130d', fontSize: 15, padding: '13px 0', minWidth: 0 }}
                    />
                  </label>
                  <button type="submit" style={{ background: '#04130d', color: '#eafff5', fontWeight: 700, fontSize: 15, padding: '13px 22px', borderRadius: 12, whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', transition: 'transform .15s, background .2s', fontFamily: 'inherit' }}>
                    Subscribe
                  </button>
                </form>
                <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'rgba(4,19,13,.6)', marginTop: 12 }}>
                  Unsubscribe in one click, anytime.
                </p>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#04130d', fontWeight: 700, fontSize: 16 }}>
                <svg viewBox="0 0 24 24" fill="none" style={{ width: 20, height: 20 }}>
                  <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
                </svg>
                <span>Done — updates are headed to your inbox.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .ld-sub-grid { grid-template-columns: 1fr !important; gap: 22px !important; text-align: left; }
          .ld-sub-glyph { display: none !important; }
          .ld-notify-form { flex-direction: column; }
        }
      `}</style>
    </section>
  );
}
