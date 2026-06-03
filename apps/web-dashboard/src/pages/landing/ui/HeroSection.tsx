import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Eye, Check } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { DemoCard } from './DemoCard';
import { TRUST_ITEMS } from '../model/heroData';

export function HeroSection() {
  const triggerRef = useRef<(() => void) | null>(null);
  const navigate   = useNavigate();

  return (
    <section className="relative py-[clamp(48px,8vw,96px)]">
      {/* Background veil */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--ld-hero-veil)' }} />

      <div className="ld-wrap relative z-10">
        <div className="grid grid-cols-1 min-[980px]:grid-cols-[1.05fr_1fr] gap-[clamp(32px,5vw,72px)] items-center">

          {/* Left */}
          <div>
            {/* Badge */}
            <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold pl-[10px] pr-[13px] py-[6px] rounded-full border border-[var(--ld-border-strong)] bg-[var(--ld-surface)] text-[var(--ld-text-2)] mb-[26px]">
              <span
                className="w-[7px] h-[7px] rounded-full bg-[var(--ld-accent)] shrink-0"
                style={{ boxShadow: '0 0 0 3px var(--ld-accent-soft)' }}
              />
              <b className="text-[var(--ld-text)] font-semibold">v1.0</b> · Built on Lighthouse
            </span>

            {/* H1 */}
            <h1 className="text-[clamp(38px,6vw,70px)] font-black tracking-[-0.035em] leading-[1.04] text-[var(--ld-text)]">
              Why is your page slow?<br />
              <span style={{
                background: 'linear-gradient(96deg, var(--ld-accent) 0%, var(--ld-accent-2) 60%, var(--ld-teal) 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Now you can see it.
              </span>
            </h1>

            <p className="ld-lead mt-6">
              PerfScope opens a Lighthouse audit for any URL, shows Core Web Vitals live,
              and names the exact element dragging your load down. No guesswork — just measurement.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-[13px] mt-[34px]">
              <Button size="lg" onClick={() => { triggerRef.current?.(); navigate('/app'); }}>
                <Zap className="w-4 h-4" />
                Start a free audit
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById('proof')?.scrollIntoView({ behavior: 'smooth' })}>
                <Eye className="w-4 h-4" />
                See an example
              </Button>
            </div>

            {/* Trust items */}
            <div className="flex flex-wrap gap-5 mt-[26px]">
              {TRUST_ITEMS.map(item => (
                <span key={item} className="inline-flex items-center gap-[7px] text-[13.5px] text-[var(--ld-text-3)]">
                  <Check className="w-[15px] h-[15px] text-[var(--ld-accent)] shrink-0" strokeWidth={2.2} />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Demo card */}
          <DemoCard onTrigger={fn => { triggerRef.current = fn; }} />
        </div>
      </div>
    </section>
  );
}
