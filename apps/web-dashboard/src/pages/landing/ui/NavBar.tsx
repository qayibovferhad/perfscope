import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { BrandMark } from './BrandMark';

const NAV_LINKS = [
  { href: '#how',      label: 'How it works' },
  { href: '#features', label: 'Features'     },
  { href: '#measure',  label: 'Measurement'  },
  { href: '#faq',      label: 'FAQ'          },
] as const;

/**
 * The signed-out header. Two actions, not one: everything behind the fold needs an
 * account, so "Start audit" landing on a login form was the first thing a visitor hit.
 * Sign in is for the person who has one; the primary action makes one.
 */
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[60] border-b backdrop-blur-[14px] bg-[color-mix(in_oklab,var(--ld-bg)_72%,transparent)] transition-colors duration-300 ${
        scrolled ? 'border-ld-border' : 'border-transparent'
      }`}
    >
      <div className="ld-wrap flex items-center justify-between h-16 gap-6">
        <a href="#top" className="no-underline">
          <BrandMark />
        </a>

        <nav className="hidden min-[760px]:flex gap-1 items-center">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="text-[14.5px] text-ld-text-2 px-[13px] py-2 rounded-[9px] font-medium no-underline transition-all duration-200 hover:text-ld-text hover:bg-ld-surface-hover"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="max-[480px]:hidden">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/register">
              Get started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
