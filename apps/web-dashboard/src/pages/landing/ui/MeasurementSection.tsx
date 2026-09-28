import { Readout, Ruler } from '@/shared/ui/instrument';

/**
 * The section that says how the number was made.
 *
 * It replaced a "before and after" of an invented e-commerce page. The product's claim
 * is not that pages get faster — it is that the number on screen describes a load that
 * happened, which is the one thing a tool built on Lighthouse can promise and most do
 * not. The three rules below are the ones the backend enforces; the card on the right
 * draws a precise run the way history draws it.
 */
const RULES = [
  {
    n: '01',
    title: 'The median run, reported whole',
    body: 'A precise audit runs three isolated loads and reports the middle one — score, waterfall, filmstrip, all from the same load. Averaging metrics would describe a page load that never happened.',
  },
  {
    n: '02',
    title: 'Audits never compete for a core',
    body: 'Each run owns a Chrome, and runs sharing a CPU do not just take longer — they report worse numbers. The queue caps how many run at once and tells you your place in it.',
  },
  {
    n: '03',
    title: 'Noise is not a verdict',
    body: 'A run-to-run spread of a few points is measurement, not a change. History calls nothing a regression under ten points, and the spread of a precise run is printed beside its score.',
  },
] as const;

/** Three runs of one page, the shape a noisy site really produces. */
const RUNS = [
  { n: 1, score: 71 },
  { n: 2, score: 88 },
  { n: 3, score: 74 },
] as const;
// 74 is run 3: the middle *value*, not the middle run.
const MEDIAN = 74;
const MEAN   = (71 + 88 + 74) / 3;
const SPREAD = 88 - 71;

export function MeasurementSection() {
  return (
    <section id="measure" className="py-[clamp(72px,11vw,140px)]">
      <div className="ld-wrap">

        <div className="reveal max-w-[720px] mb-[clamp(44px,6vw,70px)]">
          <span className="ld-eyebrow block mb-4">Measurement</span>
          <h2 className="ld-h-section text-ld-text">Measured, not estimated.</h2>
          <p className="ld-lead mt-[18px]">
            Lighthouse numbers move between runs on the same page. Most tools hide that.
            PerfScope is built around it.
          </p>
        </div>

        <div className="grid grid-cols-1 min-[980px]:grid-cols-[0.95fr_1.05fr] gap-[clamp(32px,5vw,64px)] items-start">

          {/* The rules */}
          <ol className="reveal list-none p-0 m-0 grid gap-2">
            {RULES.map(({ n, title, body }) => (
              <li key={n} className="grid grid-cols-[auto_1fr] gap-x-[18px] gap-y-1 px-[22px] py-5 rounded-2xl border border-ld-border bg-ld-surface transition-[border-color,transform] duration-[250ms] hover:border-ld-accent-line hover:translate-x-1">
                <span className="font-mono text-[12px] font-semibold text-ld-accent tracking-[.08em] pt-[5px] row-span-2">{n}</span>
                <h3 className="text-[17px] font-bold text-ld-text m-0 leading-[1.2]">{title}</h3>
                <p className="text-ld-text-2 text-[14.5px] m-0 leading-[1.55]">{body}</p>
              </li>
            ))}
          </ol>

          {/* One precise run, drawn as history draws it */}
          <div className="reveal rounded-[18px] border border-ld-border-strong bg-ld-surface shadow-ld-shadow-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-[20px] py-[13px] border-b border-ld-border bg-ld-surface-2">
              <span className="font-mono text-[12.5px] text-ld-text-2 tracking-[.04em]">example.com · mobile · precise</span>
              <span className="font-mono text-[10.5px] tracking-[.08em] px-[9px] py-[3px] rounded-md border border-ld-accent-line bg-ld-accent-soft text-ld-accent-2">3 RUNS</span>
            </div>

            <div className="ps-grid-field px-[20px] pt-[22px] pb-[18px]">
              {/* The tape: each run is a mark on the same 0–100 rail. */}
              <div className="grid gap-[10px]" role="img" aria-label={`Three runs scored ${RUNS.map(r => r.score).join(', ')}. Reported: ${MEDIAN}, the median run.`}>
                {RUNS.map(({ n, score }) => {
                  const reported = score === MEDIAN;
                  return (
                    <div key={n} className="grid grid-cols-[52px_1fr_44px] items-center gap-3">
                      <span className={`font-mono text-[11px] tracking-[.08em] ${reported ? 'text-ld-accent-2' : 'text-ld-text-3'}`}>
                        RUN {n}
                      </span>
                      <div className="relative h-[8px] rounded-full bg-ld-border overflow-hidden">
                        <span
                          className={`absolute inset-y-0 left-0 rounded-full ${reported ? 'bg-ld-accent' : 'bg-ld-border-strong'}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <b className={`font-mono text-[15px] font-semibold tabular-nums text-right ${reported ? 'text-ld-accent-2' : 'text-ld-text-2'}`}>
                        {score}
                      </b>
                    </div>
                  );
                })}
              </div>
              <Ruler className="mt-[14px]" />
            </div>

            <div className="grid grid-cols-3 divide-x divide-ld-border border-t border-ld-border">
              <Readout label="Reported" value={MEDIAN} unit="/ 100" tone="good" fill={MEDIAN / 100} tint sub="run 3 — the median" />
              <Readout label="Spread" value={SPREAD} unit="pts" tone="warn" sub="noisy: above the 10-point floor" />
              <Readout
                label="Mean"
                value={<s className="decoration-ld-rose decoration-2">{MEAN.toFixed(1)}</s>}
                tone="neutral"
                sub="never reported"
              />
            </div>

            <p className="px-[20px] py-[12px] border-t border-ld-border font-mono text-[11.5px] text-ld-text-3 leading-[1.5] m-0">
              The spread is stored with the result and shown as measurement quality. A budget
              check on this run uses 74 — never 77.7.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
