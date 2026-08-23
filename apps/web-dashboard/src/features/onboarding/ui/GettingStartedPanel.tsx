import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, X, Globe, Gauge, Moon, ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import type { OnboardingStepId, OnboardingStatus } from '@perfscope/shared';
import { Button } from '@/shared/ui/button';
import { Panel } from '@/shared/ui/panel';
import { useWebsites } from '@/entities/website';
import { useOnboarding } from '../model/useOnboarding';
import { isDismissed, dismissForGood } from '../model/dismissal';

/**
 * First-run path through the product, driven by what the account actually contains.
 *
 * Each row leads with the reason rather than the instruction — a new user can follow a
 * button without ever learning why nightly audits or a budget are worth having, and that
 * is the part the UI cannot teach on its own.
 */

/** Matches the newer `ps-*` convention used for UI preferences (see 'ps-websites-view'). */


interface Step {
  id:    OnboardingStepId;
  title: string;
  /** Why the step is worth doing, not how to do it. */
  why:   string;
  icon:  LucideIcon;
  /** Label for the action that completes it. */
  cta:   string;
  /** Its destination only exists once a site is tracked. */
  needsSite?: boolean;
}

const STEPS: Step[] = [
  {
    id: 'website', title: 'Add a website', icon: Globe,
    why: 'Groups audits by site and route, so runs stay comparable over time.',
    cta: 'Add website',
  },
  {
    id: 'audit', title: 'Run your first audit', icon: Gauge,
    why: 'Scores, Core Web Vitals and a request waterfall for a single page.',
    cta: 'Open analyzer',
  },
  {
    id: 'automation', title: 'Turn on nightly audits', icon: Moon,
    why: 'Catches a regression the morning after it ships, not next quarter.',
    cta: 'Set a schedule', needsSite: true,
  },
];

/** The backend stops counting here, so anything at the ceiling is reported as "1000+". */
const COUNT_CAP = 1000;
const plural = (value: number, word: string) =>
  `${value >= COUNT_CAP ? `${COUNT_CAP}+` : value} ${word}${value === 1 ? '' : 's'}`;

/** Evidence shown beside a completed step, so "done" is visible rather than asserted. */
function evidence(id: OnboardingStepId, counts: OnboardingStatus['counts']): string | null {
  switch (id) {
    case 'website': return plural(counts.websites, 'site');
    case 'audit':   return plural(counts.audits, 'audit');
    default:        return null;
  }
}

interface Props {
  /** Opens the Add Website modal, which the host page owns. */
  onAddWebsite: () => void;
}

export function GettingStartedPanel({ onAddWebsite }: Props) {
  const { data: status } = useOnboarding();
  // Resolved here rather than passed in: the host page's list is paginated and filtered,
  // so its first row is not reliably the account's first site. The ['websites'] query is
  // already mounted on that page, so this is deduped rather than a second request.
  const { websites } = useWebsites();
  const firstSiteId = websites[0]?._id;
  const [dismissed, setDismissed] = useState(isDismissed);

  // Pending and failed both render nothing. A skeleton flashing above the headline
  // numbers is worse than a beat of nothing, and guidance must never block the page.
  if (!status || dismissed || status.complete) return null;

  const done  = STEPS.filter(s => status.steps[s.id]).length;
  const first = STEPS.find(s => !status.steps[s.id]);

  function dismiss() {
    dismissForGood();
    setDismissed(true);
  }

  const destination = (id: OnboardingStepId): string =>
    id === 'audit'      ? '/app'
    : id === 'automation' ? '/automation'
    : '/websites';

  return (
    <Panel className="mb-[26px]">

      {/* Heading band */}
      <div className="flex items-center gap-[12px] px-[22px] py-[16px] border-b border-ld-border">
        <span className="w-[32px] h-[32px] rounded-[9px] grid place-items-center bg-ld-accent-soft border border-ld-accent-line text-ld-accent shrink-0">
          <Gauge className="w-[15px] h-[15px]" />
        </span>
        <div className="min-w-0 flex-1">
          <b className="block text-[14px] font-bold text-ld-text">Getting started</b>
          <span className="block text-[12px] text-ld-text-3 mt-[2px]">
            {done} of {STEPS.length} done
            {/* Not lowercased: it would turn "RUM" into "rum". */}
            {first ? ` · next: ${first.title}` : ''}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={dismiss}
          aria-label="Dismiss getting started"
          className="shrink-0 text-ld-text-3"
        >
          <X />
        </Button>
      </div>

      {/* Steps */}
      <div>
        {STEPS.map((step, i) => {
          const complete = status.steps[step.id];
          const note     = complete ? evidence(step.id, status.counts) : null;
          const Icon     = step.icon;

          return (
            <div
              key={step.id}
              // Wraps on a phone: side by side, the button keeps its natural width and the
              // step's one explanatory sentence gets what is left — which was a column
              // narrow enough to break it over four lines.
              className={`flex items-start gap-[13px] max-sm:flex-wrap px-[22px] max-sm:px-[16px] py-[16px] ${
                i < STEPS.length - 1 ? 'border-b border-ld-border' : ''
              }`}
            >
              <span className={`w-[32px] h-[32px] rounded-[9px] grid place-items-center shrink-0 border ${
                complete
                  ? 'bg-ld-accent-soft border-ld-accent-line text-ld-accent'
                  : 'bg-ld-surface-2 border-ld-border text-ld-text-3'
              }`}>
                <Icon className="w-[15px] h-[15px]" />
              </span>

              <span className="min-w-0 flex-1 max-sm:basis-[calc(100%-45px)]">
                <b className={`block text-[13.5px] font-semibold ${complete ? 'text-ld-text-3' : 'text-ld-text'}`}>
                  {step.title}
                </b>
                {/* Once done, the reason has served its purpose — five paragraphs of
                    finished copy is noise. */}
                {!complete && (
                  <span className="block text-[12.5px] text-ld-text-3 mt-[3px] leading-[1.5]">
                    {step.why}
                  </span>
                )}
              </span>

              {complete ? (
                <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold text-ld-accent shrink-0 mt-[4px]">
                  <CheckCircle2 className="w-[15px] h-[15px]" />
                  {note}
                </span>
              ) : step.needsSite && !firstSiteId ? (
                <span className="text-[11.5px] text-ld-text-3 shrink-0 mt-[6px]">
                  Add a website first
                </span>
              ) : step.id === 'website' ? (
                <Button size="md" variant="outline" className="shrink-0 max-sm:w-full max-sm:justify-center" onClick={onAddWebsite}>
                  {step.cta} <ArrowRight />
                </Button>
              ) : (
                <Button size="md" variant="outline" className="shrink-0 max-sm:w-full max-sm:justify-center" asChild>
                  <Link to={destination(step.id)}>
                    {step.cta} <ArrowRight />
                  </Link>
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
