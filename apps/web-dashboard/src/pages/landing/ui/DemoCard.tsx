import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/shared/ui/button';
import { scoreBand } from '@/entities/analysis';
import { CIRC, METRICS_DATA, FINAL_METRICS } from '../model/heroData';
import { easeOut } from '../lib/animations';

type AuditState = 'idle' | 'running' | 'done';

export interface DemoCardProps { onTrigger: (fn: () => void) => void; }

export function DemoCard({ onTrigger }: DemoCardProps) {
  const [state, setState]             = useState<AuditState>('idle');
  const [score, setScore]             = useState(0);
  const [metrics, setMetrics]         = useState({ lcp: '—', cls: '—', tbt: '—', fcp: '—' });
  const [footText, setFootText]       = useState('Enter a URL and hit "Run"');
  const [footOpacity, setFootOpacity] = useState(0.45);
  const [url, setUrl]                 = useState('https://example.com');
  const rafRef       = useRef<number | null>(null);
  const runningRef   = useRef(false);
  const cardRef      = useRef<HTMLDivElement>(null);
  const circleRef    = useRef<SVGCircleElement>(null);
  const autoFiredRef = useRef(false);

  const gaugeStroke = { good: 'var(--ld-accent)', warn: 'var(--ld-amber)', poor: 'var(--ld-rose)' }[scoreBand(score)];

  const runAudit = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    // reset gauge immediately via DOM — no React transition lag
    if (circleRef.current) circleRef.current.style.strokeDashoffset = String(CIRC);

    setScore(0);
    setMetrics({ lcp: '—', cls: '—', tbt: '—', fcp: '—' });
    setState('running');
    setFootOpacity(0.45);
    setFootText(`Auditing ${url || 'page'} …`);

    const target = 94;
    const dur    = 1700;
    const start  = performance.now();
    let metricsShown = false;

    function frame(now: number) {
      const t = Math.min(1, (now - start) / dur);
      const s = Math.round(target * easeOut(t));
      const offset = (CIRC * (1 - s / 100)).toFixed(2);

      // update SVG directly — bypass React re-render for smooth animation
      if (circleRef.current) circleRef.current.style.strokeDashoffset = offset;
      setScore(s);

      if (t > 0.45 && !metricsShown) {
        metricsShown = true;
        (Object.keys(FINAL_METRICS) as (keyof typeof FINAL_METRICS)[]).forEach((k, i) => {
          setTimeout(() => setMetrics(prev => ({ ...prev, [k]: FINAL_METRICS[k] })), i * 140);
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

  useEffect(() => { onTrigger(() => setTimeout(runAudit, 350)); }, [onTrigger, runAudit]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !autoFiredRef.current) {
        autoFiredRef.current = true;
        setTimeout(runAudit, 500);
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [runAudit]);

  const statusLabel = state === 'running' ? 'RUNNING' : state === 'done' ? 'DONE' : 'READY';

  return (
    <div
      ref={cardRef}
      className="rounded-[18px] border border-[var(--ld-border-strong)] bg-[var(--ld-surface)] overflow-hidden"
      style={{ boxShadow: 'var(--ld-shadow-card)' }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-[13px] border-b border-[var(--ld-border)] bg-[var(--ld-surface-2)]">
        <span className="font-mono text-[12.5px] text-[var(--ld-text-2)]">perfscope — audit</span>
        <span className={[
          'inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[.08em] font-semibold px-[9px] py-[3px] rounded-md border',
          state === 'running'
            ? 'text-[var(--ld-amber)] border-[rgba(230,162,60,.35)] bg-[rgba(230,162,60,.1)]'
            : 'text-[var(--ld-accent-2)] border-[var(--ld-accent-line)] bg-[var(--ld-accent-soft)]',
        ].join(' ')}>
          <span className={`w-1.5 h-1.5 rounded-full bg-current inline-block${state === 'running' ? ' ld-pulse' : ''}`} />
          {statusLabel}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* URL row */}
        <div className="flex items-center gap-[10px] px-[13px] py-[11px] rounded-[11px] border border-[var(--ld-border)] bg-[var(--ld-bg-2)]">
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-[var(--ld-text-3)] shrink-0">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/>
            <path d="M3 12h18M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18" stroke="currentColor" strokeWidth="1.4"/>
          </svg>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runAudit(); }}
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent border-none outline-none text-[var(--ld-text)] font-mono text-[13px] min-w-0"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={runAudit}
            disabled={state === 'running'}
            className="font-mono text-[12px] text-[var(--ld-accent-2)] border border-[var(--ld-accent-line)] bg-[var(--ld-accent-soft)] hover:bg-[var(--ld-accent-soft)] px-[11px] py-[5px] h-auto rounded-lg"
          >
            {state === 'running' ? '···' : 'RUN'}
          </Button>
        </div>

        {/* Gauge + metrics */}
        <div className="grid grid-cols-[auto_1fr] gap-[14px] items-center">
          {/* Gauge */}
          <div className="relative w-[118px] h-[118px]">
            <svg viewBox="0 0 120 120" className="w-[118px] h-[118px] -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--ld-border)" strokeWidth="9" />
              <circle
                ref={circleRef}
                cx="60" cy="60" r="52" fill="none"
                stroke={gaugeStroke} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={CIRC}
                style={{ filter: 'drop-shadow(0 0 6px var(--ld-accent-soft))', transition: 'stroke .3s' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3px]">
              <b className="font-mono text-[30px] font-semibold text-[var(--ld-accent-2)] leading-none">{score}</b>
              <span className="font-mono text-[11px] text-[var(--ld-text-3)]">/ 100</span>
            </div>
          </div>

          {/* 2×2 metric grid */}
          <div className="grid grid-cols-2 gap-[9px]">
            {METRICS_DATA.map(({ key, label, status, sub }) => (
              <div
                key={key}
                className={`px-3 py-[10px] rounded-[11px] bg-[var(--ld-surface-2)] border ${
                  status === 'good' ? 'border-[rgba(20,192,138,.22)]' : 'border-[rgba(230,162,60,.25)]'
                }`}
              >
                <div className="font-mono text-[10px] tracking-[.1em] text-[var(--ld-text-3)] uppercase">{label}</div>
                <div className={`font-mono text-[17px] font-semibold mt-[3px] ${
                  status === 'good' ? 'text-[var(--ld-accent-2)]' : 'text-[var(--ld-amber)]'
                }`}>
                  {metrics[key as keyof typeof metrics]}
                </div>
                <div className="text-[10.5px] text-[var(--ld-text-3)] mt-[1px]">{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-[9px] px-[13px] py-[11px] rounded-[11px] bg-[var(--ld-accent-soft)] border border-[var(--ld-accent-line)] text-[13px] text-[var(--ld-accent-2)] font-medium transition-opacity duration-300"
          style={{ opacity: footOpacity }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 shrink-0">
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/>
          </svg>
          <span>{footText}</span>
        </div>
      </div>
    </div>
  );
}
