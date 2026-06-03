import { useRef, useState, useEffect, useCallback } from 'react';

type AuditState = 'idle' | 'running' | 'done';

const CIRC = 326.7;

function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }

interface DemoCardProps {
  onTrigger: (fn: () => void) => void;
}

function DemoCard({ onTrigger }: DemoCardProps) {
  const [state, setState] = useState<AuditState>('idle');
  const [score, setScore] = useState(0);
  const [metrics, setMetrics] = useState({ lcp: '—', cls: '—', tbt: '—', fcp: '—' });
  const [footText, setFootText] = useState('Enter a URL and hit "Run"');
  const [footOpacity, setFootOpacity] = useState(0.45);
  const [url, setUrl] = useState('https://example.com');
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const autoFiredRef = useRef(false);

  const gaugeStroke = score >= 90 ? 'var(--ld-accent)' : score >= 50 ? 'var(--ld-amber)' : 'var(--ld-rose)';
  const dashOffset = (CIRC * (1 - score / 100)).toFixed(2);

  const runAudit = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    setScore(0);
    setMetrics({ lcp: '—', cls: '—', tbt: '—', fcp: '—' });
    setState('running');
    setFootOpacity(0.45);
    setFootText(`Auditing ${url || 'page'} …`);

    const target = 94;
    const dur = 1700;
    const start = performance.now();
    let metricsShown = false;
    const finalMetrics = { lcp: '1.2s', cls: '0.04', tbt: '160ms', fcp: '0.9s' };
    const metricKeys = ['lcp', 'cls', 'tbt', 'fcp'] as const;

    function frame(now: number) {
      const t = Math.min(1, (now - start) / dur);
      const e = easeOut(t);
      const s = Math.round(target * e);
      setScore(s);

      if (t > 0.45 && !metricsShown) {
        metricsShown = true;
        metricKeys.forEach((k, i) => {
          setTimeout(() => {
            setMetrics(prev => ({ ...prev, [k]: finalMetrics[k] }));
          }, i * 140);
        });
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        runningRef.current = false;
        setState('done');
        setFootOpacity(1);
        setFootText('All Core Web Vitals passing — 1 metric to watch');
      }
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [url]);

  // Expose trigger to parent
  useEffect(() => {
    onTrigger(() => setTimeout(runAudit, 350));
  }, [onTrigger, runAudit]);

  // Auto-run on view
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !autoFiredRef.current) {
          autoFiredRef.current = true;
          setTimeout(runAudit, 500);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [runAudit]);

  const statusLabel = state === 'running' ? 'RUNNING' : state === 'done' ? 'DONE' : 'READY';

  return (
    <div
      ref={cardRef}
      style={{
        borderRadius: 18, border: '1px solid var(--ld-border-strong)', background: 'var(--ld-surface)',
        boxShadow: 'var(--ld-shadow-card)', overflow: 'hidden',
      }}
    >
      {/* Title bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--ld-border)', background: 'var(--ld-surface-2)' }}>
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: 'var(--ld-text-2)' }}>perfscope — audit</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: "'Geist Mono', monospace", fontSize: 11, letterSpacing: '.08em',
          color: state === 'running' ? 'var(--ld-amber)' : 'var(--ld-accent-2)',
          borderColor: state === 'running' ? 'rgba(230,162,60,.35)' : 'var(--ld-accent-line)',
          background: state === 'running' ? 'rgba(230,162,60,.1)' : 'var(--ld-accent-soft)',
          fontWeight: 600, padding: '3px 9px', borderRadius: 6, border: '1px solid',
        }}>
          <span className={state === 'running' ? 'ld-pulse' : ''} style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
          {statusLabel}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: 16 }}>
        {/* URL row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 11, border: '1px solid var(--ld-border)', background: 'var(--ld-bg-2)', marginBottom: 16 }}>
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16, color: 'var(--ld-text-3)', flexShrink: 0 }}>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/>
            <path d="M3 12h18M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18" stroke="currentColor" strokeWidth="1.4"/>
          </svg>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runAudit(); }}
            spellCheck={false}
            autoComplete="off"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--ld-text)', fontFamily: "'Geist Mono', monospace", fontSize: 13, minWidth: 0 }}
          />
          <button
            onClick={runAudit}
            disabled={state === 'running'}
            style={{
              fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--ld-accent-2)', fontWeight: 600,
              padding: '5px 11px', borderRadius: 8, border: '1px solid var(--ld-accent-line)', background: 'var(--ld-accent-soft)',
              cursor: state === 'running' ? 'default' : 'pointer', opacity: state === 'running' ? 0.5 : 1,
              transition: 'all .2s',
            }}
          >
            {state === 'running' ? '···' : 'RUN'}
          </button>
        </div>

        {/* Main: gauge + metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'center' }}>
          {/* Gauge */}
          <div style={{ position: 'relative', width: 118, height: 118 }}>
            <svg viewBox="0 0 120 120" style={{ width: 118, height: 118, transform: 'rotate(-90deg)' }}>
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--ld-border)" strokeWidth="9" />
              <circle
                cx="60" cy="60" r="52" fill="none"
                stroke={gaugeStroke} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={dashOffset}
                style={{ filter: 'drop-shadow(0 0 6px var(--ld-accent-soft))', transition: 'stroke-dashoffset .1s linear, stroke .3s' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              <b style={{ fontFamily: "'Geist Mono', monospace", fontSize: 30, fontWeight: 600, color: 'var(--ld-accent-2)', lineHeight: 1 }}>{score}</b>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--ld-text-3)', marginTop: 3 }}>/ 100</span>
            </div>
          </div>

          {/* 2x2 metric grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            {([
              { key: 'lcp', label: 'LCP', status: 'good', sub: 'Good', val: metrics.lcp },
              { key: 'cls', label: 'CLS', status: 'good', sub: 'Good', val: metrics.cls },
              { key: 'tbt', label: 'TBT', status: 'warn', sub: 'Needs work', val: metrics.tbt },
              { key: 'fcp', label: 'FCP', status: 'good', sub: 'Good', val: metrics.fcp },
            ] as const).map(({ key, label, status, sub, val }) => (
              <div
                key={key}
                style={{
                  padding: '10px 12px', borderRadius: 11, background: 'var(--ld-surface-2)',
                  border: `1px solid ${status === 'good' ? 'rgba(20,192,138,.22)' : 'rgba(230,162,60,.25)'}`,
                }}
              >
                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: '.1em', color: 'var(--ld-text-3)', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 17, fontWeight: 600, marginTop: 3, color: status === 'good' ? 'var(--ld-accent-2)' : 'var(--ld-amber)' }}>{val}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ld-text-3)', marginTop: 1 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 14, display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px',
            borderRadius: 11, background: 'var(--ld-accent-soft)', border: '1px solid var(--ld-accent-line)',
            fontSize: 13, color: 'var(--ld-accent-2)', fontWeight: 500, opacity: footOpacity,
            transition: 'opacity .3s',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16, flexShrink: 0 }}>
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/>
          </svg>
          <span>{footText}</span>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  const triggerRef = useRef<(() => void) | null>(null);

  function handleTrigger(fn: () => void) {
    triggerRef.current = fn;
  }

  return (
    <section style={{ padding: 'clamp(48px, 8vw, 96px) 0 clamp(56px, 9vw, 110px)', position: 'relative' }}>
      {/* Background veil */}
      <div style={{ content: '', position: 'absolute', inset: 0, background: 'var(--ld-hero-veil)', pointerEvents: 'none', zIndex: 0 }} />

      <div className="ld-wrap" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.05fr 1fr',
          gap: 'clamp(32px, 5vw, 72px)',
          alignItems: 'center',
        }} className="ld-hero-grid">

          {/* Left */}
          <div>
            {/* Badge */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600,
              padding: '6px 13px 6px 10px', borderRadius: 999, border: '1px solid var(--ld-border-strong)',
              background: 'var(--ld-surface)', color: 'var(--ld-text-2)', marginBottom: 26,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ld-accent)', boxShadow: '0 0 0 3px var(--ld-accent-soft)' }} />
              <b style={{ color: 'var(--ld-text)', fontWeight: 600 }}>v1.0</b> · Built on Lighthouse
            </span>

            {/* H1 */}
            <h1 style={{ fontSize: 'clamp(38px, 6.0vw, 70px)', fontWeight: 900, letterSpacing: '-0.035em', lineHeight: 1.04, color: 'var(--ld-text)' }}>
              Why is your page slow?<br />
              <span style={{
                background: 'linear-gradient(96deg, var(--ld-accent) 0%, var(--ld-accent-2) 60%, var(--ld-teal) 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>Now you can see it.</span>
            </h1>

            <p className="ld-lead" style={{ marginTop: 24 }}>
              PerfScope opens a Lighthouse audit for any URL, shows Core Web Vitals live, and names the exact element dragging your load down. No guesswork — just measurement.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 13, marginTop: 34, flexWrap: 'wrap' }}>
              <button
                onClick={() => triggerRef.current?.()}
                className="ld-btn ld-btn-primary ld-btn-lg"
              >
                <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
                  <path d="M13 2 4.5 13H11l-1 9 9-12h-7l1-8Z" fill="currentColor"/>
                </svg>
                Start a free audit
              </button>
              <a href="#proof" className="ld-btn ld-btn-ghost ld-btn-lg">
                <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.8"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                </svg>
                See an example
              </a>
            </div>

            {/* Trust items */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 26 }}>
              {['No card required', 'Open source, MIT licensed', 'First result in ~60s'].map(item => (
                <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: 'var(--ld-text-3)' }}>
                  <svg viewBox="0 0 24 24" fill="none" style={{ width: 15, height: 15, color: 'var(--ld-accent)' }}>
                    <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Demo card */}
          <div>
            <DemoCard onTrigger={handleTrigger} />
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .ld-hero-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
