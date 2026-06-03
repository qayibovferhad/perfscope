import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';

const NAV_LINKS = [
  { href: '#how',      label: 'How it works' },
  { href: '#features', label: 'Features'     },
  { href: '#proof',    label: 'Results'      },
  { href: '#faq',      label: 'FAQ'          },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[60] border-b backdrop-blur-[14px] transition-colors duration-300 ${
        scrolled ? 'border-[var(--ld-border)]' : 'border-transparent'
      }`}
      style={{ background: 'color-mix(in oklab, var(--ld-bg) 72%, transparent)' }}
    >
      <div className="ld-wrap flex items-center justify-between h-16 gap-6">
        {/* Brand */}
        <a
          href="#top"
          className="flex items-center gap-[10px] font-bold text-[17px] tracking-[-0.02em] text-[var(--ld-text)] no-underline"
        >
          <span
            className="w-[30px] h-[30px] rounded-[9px] grid place-items-center shrink-0"
            style={{ background: 'var(--ld-grad)', boxShadow: 'var(--ld-glow)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-[17px] h-[17px]">
              <path d="M3 12h3l2.5-7 4 14 3-9 2 2H21" stroke="#04130d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span>Perf<b className="text-[var(--ld-accent-2)] font-extrabold">Scope</b></span>
        </a>

        {/* Nav links */}
        <nav className="hidden min-[760px]:flex gap-1 items-center">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="text-[14.5px] text-[var(--ld-text-2)] px-[13px] py-2 rounded-[9px] font-medium no-underline transition-all duration-200 hover:text-[var(--ld-text)] hover:bg-[var(--ld-surface-hover)]"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <Button onClick={() => navigate('/app')}>
          Start audit
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
