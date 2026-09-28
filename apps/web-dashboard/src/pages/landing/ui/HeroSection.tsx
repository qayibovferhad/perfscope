import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Eye, Check } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { DemoCard } from './DemoCard';
import { TRUST_ITEMS } from '../model/heroData';

export function HeroSection() {
  const triggerRef = useRef<(() => void) | null>(null);

  return (
    // The header is fixed and 64px tall; the section clears it itself rather than relying
    // on a body offset, because it is the only section that starts at the top of the page.
    <section className="relative pt-[calc(64px+clamp(28px,5vw,64px))] pb-[clamp(48px,8vw,96px)]">
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--ld-hero-veil)]" />

      <div className="ld-wrap relative z-10">
        <div className="grid grid-cols-1 min-[980px]:grid-cols-[1.05fr_1fr] gap-[clamp(32px,5vw,72px)] items-center">

          <div>
            <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold pl-[10px] pr-[13px] py-[6px] rounded-full border border-ld-border-strong bg-ld-surface text-ld-text-2 mb-[26px]">
              <span className="w-[7px] h-[7px] rounded-full bg-ld-accent shrink-0 shadow-[0_0_0_3px_var(--ld-accent-soft)]" />
              <b className="text-ld-text font-semibold">v1.0</b> · Built on Lighthouse
            </span>

            <h1 className="text-[clamp(38px,6vw,70px)] font-black tracking-[-0.035em] leading-[1.04] text-ld-text">
              Why is your page slow?<br />
              <span className="bg-[linear-gradient(96deg,var(--ld-accent)_0%,var(--ld-accent-2)_60%,var(--ld-teal)_100%)] bg-clip-text text-transparent">
                Now you can see it.
              </span>
            </h1>

            <p className="ld-lead mt-6">
              PerfScope runs a Lighthouse audit on any URL, streams the scores as they land,
              and shows the element behind every failing check — with what moved since the
              last run of the same page.
            </p>

            <div className="flex flex-wrap gap-[13px] mt-[34px]">
              <Button asChild size="lg">
                <Link to="/register" onClick={() => triggerRef.current?.()}>
                  <Zap className="w-4 h-4" />
                  Create an account
                </Link>
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById('measure')?.scrollIntoView({ behavior: 'smooth' })}>
                <Eye className="w-4 h-4" />
                See how it measures
              </Button>
            </div>

            <div className="flex flex-wrap gap-5 mt-[26px]">
              {TRUST_ITEMS.map(item => (
                <span key={item} className="inline-flex items-center gap-[7px] text-[13.5px] text-ld-text-3">
                  <Check className="w-[15px] h-[15px] text-ld-accent shrink-0" strokeWidth={2.2} />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <DemoCard onTrigger={fn => { triggerRef.current = fn; }} />
        </div>
      </div>
    </section>
  );
}
