import { Link } from 'react-router-dom';
import {
  Gauge, Network, Layers, Sparkles, GitCompareArrows, Film, Globe, Plus, ArrowRight,
} from 'lucide-react';
import type { Website } from '@/entities/website';
import { getHostname } from '@/entities/website';
import { Button } from '@/shared/ui/button';

type Variant = 'analyze' | 'compare';

interface Props {
  variant: Variant;
  /** Tracked sites offered as one-click starters. */
  sites:   Website[];
  onPick:  (url: string) => void;
}

const OUTPUTS: Record<Variant, { icon: React.ElementType; title: string; body: string }[]> = {
  analyze: [
    { icon: Gauge,   title: 'Scores & Core Web Vitals', body: 'Performance, accessibility, best practices and SEO, streamed as each pair finishes.' },
    { icon: Network, title: 'Network waterfall',        body: 'Every request on a timeline, replayable against the page filmstrip.' },
    { icon: Layers,  title: 'Resource breakdown',       body: 'Weight by type, dependency chains, long tasks and layout shifts.' },
    { icon: Sparkles,title: 'AI insights',              body: 'What to fix first, and per-resource advice on the heaviest requests.' },
  ],
  compare: [
    { icon: GitCompareArrows, title: 'Side-by-side scoreboard', body: 'Both sites audited in parallel, every metric aligned for a direct read.' },
    { icon: Network,          title: 'Waterfall comparison',    body: 'Where the two request timelines diverge, and which side pays for it.' },
    { icon: Film,             title: 'Filmstrip comparison',    body: 'Frame-by-frame loading, so you can see which page paints first.' },
    { icon: Layers,           title: 'Deep comparison',         body: 'Resource weight, counts and third parties, broken down per side.' },
  ],
};

const COPY: Record<Variant, { title: string; body: string; pick: string }> = {
  analyze: {
    title: 'Nothing analyzed yet',
    body:  'Enter a URL above and the full report lands here.',
    pick:  'Or start from one of your sites',
  },
  compare: {
    title: 'Nothing to compare yet',
    body:  'Fill both sides above, then launch the analysis.',
    pick:  'Or drop one of your sites into the left side',
  },
};

/**
 * Fills the page below the input while no analysis has run — the area was simply blank
 * on first visit. Doubles as a shortcut: tracked sites are one click away, which is the
 * most common thing to audit.
 */
export function AnalysisIdlePanel({ variant, sites, onPick }: Props) {
  const copy    = COPY[variant];
  const outputs = OUTPUTS[variant];
  const picks   = sites.slice(0, 6);

  return (
    <div className="rounded-[18px] border border-ld-border bg-ld-surface overflow-hidden">

      {/* Heading */}
      <div className="px-[24px] pt-[26px] pb-[20px] text-center">
        <span className="w-[46px] h-[46px] rounded-[13px] grid place-items-center mx-auto mb-[14px] bg-ld-surface-2 border border-ld-border text-ld-accent">
          {variant === 'compare'
            ? <GitCompareArrows className="w-[22px] h-[22px]" />
            : <Gauge className="w-[22px] h-[22px]" />}
        </span>
        <p className="text-[16px] font-bold text-ld-text">{copy.title}</p>
        <p className="text-[13.5px] text-ld-text-2 mt-[5px]">{copy.body}</p>
      </div>

      {/* What the run produces */}
      <div className="grid grid-cols-2 max-[720px]:grid-cols-1 border-t border-ld-border">
        {outputs.map(({ icon: Icon, title, body }, i) => (
          <div
            key={title}
            className={`flex items-start gap-[13px] px-[22px] py-[18px] border-ld-border
              ${i % 2 === 0 ? 'border-r max-[720px]:border-r-0' : ''}
              ${i < 2 ? 'border-b' : 'max-[720px]:border-b'}`}
          >
            <span className="w-[32px] h-[32px] rounded-[9px] grid place-items-center shrink-0 bg-ld-accent-soft border border-ld-accent-line text-ld-accent">
              <Icon className="w-[15px] h-[15px]" />
            </span>
            <span className="min-w-0">
              <b className="block text-[13.5px] font-semibold text-ld-text">{title}</b>
              <span className="block text-[12.5px] text-ld-text-3 mt-[3px] leading-[1.5]">{body}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Quick start from a tracked site */}
      <div className="px-[22px] py-[18px] border-t border-ld-border bg-ld-surface-2">
        {picks.length > 0 ? (
          <>
            <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ld-text-3 mb-[12px]">
              {copy.pick}
            </p>
            <div className="flex flex-wrap gap-[8px]">
              {picks.map(site => (
                <button
                  key={site._id}
                  type="button"
                  onClick={() => onPick(site.url)}
                  className="group inline-flex items-center gap-[8px] px-[12px] py-[7px] rounded-[10px] border border-ld-border bg-ld-surface text-[12.5px] text-ld-text-2 transition-colors duration-200 hover:border-ld-accent-line hover:text-ld-accent"
                >
                  <Globe className="w-[13px] h-[13px] text-ld-text-3 transition-colors duration-200 group-hover:text-ld-accent" />
                  <span className="font-mono">{getHostname(site.url)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-[14px] flex-wrap">
            <p className="text-[12.5px] text-ld-text-3">
              Track a website to keep its audits together and compare runs over time.
            </p>
            <Button variant="outline" size="md" asChild>
              <Link to="/websites">
                <Plus /> Add a website <ArrowRight />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
