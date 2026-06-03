import { ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';

const STATS = [
  {
    num: '53', unit: '%',
    copy: 'of people abandon a mobile visit when a page takes longer than three seconds to load.',
    src: 'Google / SOASTA mobile research',
    accent: false,
  },
  {
    num: '7', unit: '%',
    copy: 'drop in conversions can follow from just one tenth of a second of extra delay at checkout.',
    src: 'Akamai performance study',
    accent: false,
  },
  {
    num: '3', unit: '',
    copy: 'Core Web Vitals — LCP, INP and CLS — feed directly into how Google ranks your page.',
    src: 'Google Search ranking signals',
    accent: true,
  },
] as const;

export function WhySection() {
  return (
    <section className="border-y border-[var(--ld-border)] bg-[var(--ld-bg-2)] py-[clamp(64px,9vw,110px)]">
      <div className="ld-wrap">
        <div className="grid grid-cols-1 min-[980px]:grid-cols-[0.92fr_1.08fr] gap-[clamp(36px,6vw,80px)] items-center">

          {/* Left */}
          <div className="reveal">
            <span className="ld-eyebrow block mb-[18px]">Why it matters</span>
            <h2 className="text-[clamp(28px,3.6vw,44px)] font-extrabold tracking-[-0.03em] leading-[1.04] text-[var(--ld-text)]">
              A slow page isn't a bug report.<br />It's a quiet leak.
            </h2>
            <p className="text-[var(--ld-text-2)] text-[clamp(15px,1.4vw,17.5px)] mt-5 max-w-[46ch]">
              Nobody files a ticket because a page felt sluggish — they just leave, and you never
              hear about it. Speed is the part of the product your visitors feel before they read a
              single word. Here's what's actually at stake.
            </p>
            <Button
              variant="ghost"
              className="mt-[26px] px-0 text-[var(--ld-accent)] hover:bg-transparent hover:text-[var(--ld-accent-2)] gap-2 group"
              onClick={() => document.getElementById('proof')?.scrollIntoView({ behavior: 'smooth' })}
            >
              See a real before &amp; after
              <ArrowRight className="w-[17px] h-[17px] transition-transform duration-200 group-hover:translate-x-1" />
            </Button>
          </div>

          {/* Right: stat cards */}
          <div className="grid gap-[14px]">
            {STATS.map(({ num, unit, copy, src, accent }) => (
              <div
                key={num}
                className="reveal grid grid-cols-[auto_1fr] gap-x-[22px] gap-y-[6px] items-baseline px-[26px] py-6 rounded-2xl border border-[var(--ld-border)] bg-[var(--ld-surface)] cursor-default transition-[border-color,transform,background] duration-[250ms] hover:border-[var(--ld-accent-line)] hover:translate-x-1 hover:bg-[var(--ld-surface-2)]"
              >
                <div className="row-span-2">
                  <b className={`font-mono text-[clamp(40px,5vw,56px)] font-semibold leading-[0.9] tracking-[-0.04em] inline-flex items-start ${accent ? 'text-[var(--ld-accent-2)]' : 'text-[var(--ld-text)]'}`}>
                    {num}
                    {unit && <i className="not-italic text-[0.5em] text-[var(--ld-text-3)] mt-[0.25em] ml-[1px]">{unit}</i>}
                  </b>
                </div>
                <p className="text-[var(--ld-text)] text-[15px] leading-[1.5] self-center m-0">{copy}</p>
                <span className="font-mono text-[11px] tracking-[0.04em] text-[var(--ld-text-3)] col-start-2">{src}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
