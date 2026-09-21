import { Link } from 'react-router-dom';
import { Gauge, GitCompareArrows, Globe, Plus, ArrowRight } from 'lucide-react';
import type { Website } from '@/entities/website';
import { getHostname } from '@/entities/website';
import { Button } from '@/shared/ui/button';
import { Dial } from '@/shared/ui/instrument';
import { cn } from '@/shared/lib/utils';

type Variant = 'analyze' | 'compare';

interface Props {
  variant: Variant;
  /** Tracked sites offered as one-click starters. */
  sites:   Website[];
  onPick:  (url: string) => void;
  /** `failed` when the last attempt errored — the panel is then the way back, not a welcome. */
  state?:  'idle' | 'failed';
}

/**
 * What the run produces, as short labels rather than the full description blocks this
 * used to be — a returning user (this panel's most frequent audience, since it's what
 * they see between every audit) already knows what the tool does; a one-line reminder
 * earns its space, a paragraph re-explaining the product doesn't.
 */
const BADGES: Record<Variant, string[]> = {
  analyze: ['Scores & vitals', 'Network waterfall', 'Resource breakdown', 'AI insights'],
  compare: ['Side-by-side scores', 'Waterfall diff', 'Filmstrip diff', 'Deep comparison'],
};

/** Shown in place of the heading above when the previous run errored. The error card
 *  right above already says what went wrong, so this says what to do about it. */
const FAILED_COPY: Record<Variant, { title: string; body: string }> = {
  analyze: {
    title: 'That run did not finish',
    body:  'Check the URL above and try again — or start from one of your sites below.',
  },
  compare: {
    title: 'That comparison did not finish',
    body:  'Check both URLs above and try again — or start from one of your sites below.',
  },
};

const COPY: Record<Variant, { title: string; body: string; pick: string }> = {
  analyze: {
    title: 'Nothing analyzed yet',
    body:  'Enter a URL above and the full report lands here.',
    pick:  'Or jump straight to one of your sites',
  },
  compare: {
    title: 'Nothing to compare yet',
    body:  'Fill both sides above, then launch the analysis.',
    pick:  'Or jump straight to one of your sites',
  },
};

/**
 * Fills the page below the input while no analysis has run — the area was simply blank
 * on first visit. One focal icon and a single line of intent lead; everything else (what
 * the run produces, which site to start from) is a lighter-weight second thought, not a
 * second heading competing for the same first glance.
 */
export function AnalysisIdlePanel({ variant, sites, onPick, state = 'idle' }: Props) {
  const failed = state === 'failed';
  const copy   = { ...COPY[variant], ...(failed ? FAILED_COPY[variant] : {}) };
  const picks  = sites.slice(0, 6);
  const Icon   = variant === 'compare' ? GitCompareArrows : Gauge;

  return (
    <div className="ps-grid-field ps-marks rounded-[18px] border border-ld-border bg-ld-surface overflow-hidden">

      {/* An instrument waiting for a reading, rather than a welcome card: the same dial
          the scores will be drawn in, with its needle at rest. Left-aligned, because a
          centred column of three centred lines is the shape every empty screen in every
          dashboard has, and this one is seen between every audit. */}
      <div className="px-[28px] py-[34px] max-sm:px-[18px] flex items-center gap-[26px] max-sm:flex-col max-sm:text-center max-sm:gap-[18px]">
        <Dial
          value={null}
          size="lg"
          tone={failed ? 'neutral' : 'accent'}
          decorative
          glyph={<Icon className={cn('w-[24px] h-[24px]', failed && 'text-ld-text-3')} />}
        />

        <div className="min-w-0">
          <p className="text-[18px] font-bold text-ld-text">{copy.title}</p>
          <p className="text-[13.5px] text-ld-text-2 mt-[6px] max-w-[46ch] leading-[1.5]">{copy.body}</p>

          {/* What the run will report, as the dial's legend — mono, quiet, one line. */}
          {!failed && (
            <div className="flex flex-wrap items-center gap-[8px] mt-[14px] max-sm:justify-center">
              {BADGES[variant].map((label) => (
                <span
                  key={label}
                  className="font-mono text-[11px] text-ld-text-3 px-[11px] py-[5px] rounded-full border border-ld-border bg-ld-bg-2"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick start from a tracked site */}
      <div className="px-[24px] py-[20px] border-t border-ld-border bg-ld-surface-2">
        {picks.length > 0 ? (
          <div className="flex flex-col items-center gap-[12px]">
            <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ld-text-3">
              {copy.pick}
            </p>
            <div className="flex flex-wrap justify-center gap-[8px]">
              {picks.map((site) => (
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
          </div>
        ) : (
          <div className="flex flex-col items-center gap-[12px] text-center">
            <p className="text-[12.5px] text-ld-text-3 max-w-[320px]">
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
