const DELTAS = [
  { color: 'var(--ld-accent-2)', label: 'Performance', value: '+52',  up: true  },
  { color: 'var(--ld-teal)',     label: 'CLS',         value: '−82%', up: false },
  { color: 'var(--ld-amber)',    label: 'LCP',         value: '−75%', up: false },
  { color: 'var(--ld-accent-2)', label: 'TBT',         value: '−83%', up: false },
] as const;

interface AuditCardProps {
  title:       string;
  badge:       string;
  score:       number;
  scoreColor:  string;
  gaugeStroke: string;
  gaugeDashoffset: number;
  metrics:     readonly { v: string; l: string }[];
  metricBorder: string;
  metricBg:    string;
  borderClass: string;
  boxShadow?:  string;
}

function AuditCard({
  title, badge, score, scoreColor, gaugeStroke, gaugeDashoffset,
  metrics, metricBorder, metricBg, borderClass, boxShadow,
}: AuditCardProps) {
  return (
    <div
      className={`p-[26px] rounded-[18px] border bg-[var(--ld-surface)] ${borderClass}`}
      style={boxShadow ? { boxShadow } : undefined}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[18px] font-bold text-[var(--ld-text)] m-0">{title}</h3>
        <span
          className="font-mono text-[10.5px] tracking-[.06em] px-[10px] py-1 rounded-[7px] font-semibold"
          style={{ color: scoreColor, border: `1px solid ${metricBorder}`, background: metricBg }}
        >
          {badge}
        </span>
      </div>

      <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-3 items-center">
        {/* Gauge */}
        <div>
          <div className="relative w-[78px] h-[78px]">
            <svg viewBox="0 0 78 78" className="w-[78px] h-[78px]">
              <circle cx="39" cy="39" r="33" fill="none" stroke="var(--ld-border)" strokeWidth="7"/>
              <circle
                cx="39" cy="39" r="33" fill="none"
                stroke={gaugeStroke} strokeWidth="7" strokeLinecap="round"
                strokeDasharray="207" strokeDashoffset={gaugeDashoffset}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center font-mono text-[22px] font-semibold" style={{ color: scoreColor }}>
              {score}
            </div>
          </div>
          <div className="text-center text-[11px] text-[var(--ld-text-3)] mt-[6px]">Performance</div>
        </div>

        {/* Metric boxes */}
        {metrics.map(({ v, l }) => (
          <div key={l} className="text-center">
            <div
              className="rounded-xl px-[6px] py-4 font-mono text-[20px] font-semibold"
              style={{ color: scoreColor, border: `1px solid ${metricBorder}`, background: metricBg }}
            >
              {v}
            </div>
            <div className="text-[11px] text-[var(--ld-text-3)] mt-[6px]">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendIcon({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-[15px] h-[15px]">
      {up
        ? <path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        : <path d="M3 7l6 6 4-4 8 8"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      }
    </svg>
  );
}

export function ResultsSection() {
  return (
    <section id="proof" className="py-[clamp(72px,11vw,140px)]">
      <div className="ld-wrap">

        {/* Header */}
        <div className="reveal text-center max-w-[720px] mx-auto mb-[clamp(44px,6vw,70px)]">
          <span className="ld-eyebrow block mb-4">Real results</span>
          <h2 className="ld-h-section text-[var(--ld-text)]">Before and after — same page.</h2>
          <p className="ld-lead mt-[18px] mx-auto">
            Teams that apply PerfScope's suggestions usually reach a 90+ score within a single sprint. The example below is a real e-commerce homepage.
          </p>
        </div>

        {/* Before / arrow / after */}
        <div className="reveal grid grid-cols-1 min-[760px]:grid-cols-[1fr_auto_1fr] gap-[18px] items-center">
          <AuditCard
            title="Before PerfScope"
            badge="BASELINE"
            score={42}
            scoreColor="var(--ld-rose)"
            gaugeStroke="var(--ld-rose)"
            gaugeDashoffset={120}
            metrics={[{ v: '0.45', l: 'CLS' }, { v: '4.8s', l: 'LCP' }, { v: '820ms', l: 'TBT' }]}
            metricBorder="rgba(242,100,122,.35)"
            metricBg="rgba(242,100,122,.1)"
            borderClass="border-[var(--ld-border)]"
          />

          <div
            className="w-11 h-11 rounded-full grid place-items-center text-[#04130d] shrink-0 max-[760px]:rotate-90 max-[760px]:mx-auto"
            style={{ background: 'var(--ld-grad)', boxShadow: 'var(--ld-glow)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <AuditCard
            title="After PerfScope"
            badge="OPTIMIZED"
            score={94}
            scoreColor="var(--ld-accent-2)"
            gaugeStroke="var(--ld-accent)"
            gaugeDashoffset={12}
            metrics={[{ v: '0.08', l: 'CLS' }, { v: '1.2s', l: 'LCP' }, { v: '140ms', l: 'TBT' }]}
            metricBorder="rgba(20,192,138,.22)"
            metricBg="var(--ld-accent-soft)"
            borderClass="border-[var(--ld-accent-line)]"
            boxShadow="0 0 0 1px var(--ld-accent-soft), 0 20px 60px -34px rgba(20,192,138,.5)"
          />
        </div>

        {/* Delta pills */}
        <div className="reveal flex gap-3 justify-center flex-wrap mt-[38px]">
          {DELTAS.map(({ color, label, value, up }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 px-4 py-[9px] rounded-full border border-[var(--ld-border)] bg-[var(--ld-surface)] text-[14px]"
              style={{ color }}
            >
              <TrendIcon up={up} />
              <b className="font-mono font-semibold">{value}</b>
              <span className="text-[var(--ld-text-3)] text-[12.5px]">{label}</span>
            </span>
          ))}
        </div>

      </div>
    </section>
  );
}
