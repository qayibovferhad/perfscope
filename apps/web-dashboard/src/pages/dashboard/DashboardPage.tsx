import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, CalendarDays, BarChart3, Globe, Plus } from 'lucide-react';
import { GettingStartedPanel } from '@/features/onboarding';
import { AddWebsiteModal } from '@/features/websites';
import { Panel, PanelHeader, PanelBody } from '@/shared/ui/panel';
import { useOverview } from '@/features/overview';
import { TotalsStrip } from '@/features/overview';
import { IncidentsCard } from '@/features/overview';
import { AttentionCard } from '@/features/overview';
import { RecentAuditsCard } from '@/features/overview';
import { RumPulseCard } from '@/features/overview';
import { ScoreTrendChart } from '@/features/overview';
import { ActivityChart } from '@/features/overview';
import { VitalsSplitChart } from '@/features/overview';
import { hasActivityData, hasTrendData, hasVitalsData } from '@/features/overview';
import { cn } from '@/shared/lib/utils';
import { StatePanel } from '@/shared/ui/state-panel';
import { Skeleton } from '@/shared/ui/skeleton';
import { Page, PageHeader } from '@/shared/ui/page';
import { NextStepCard } from '@/features/advisor';
import { useGettingStartedVisible } from '@/features/onboarding';
import { DateRangePicker } from '@/shared/ui/date-range-picker';
import { rangeLabel } from '@/shared/lib/dateRange';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useWebsites, getHostname } from '@/entities/website';
import { OVERVIEW_WINDOWS, DEFAULT_OVERVIEW_WINDOW, resolveOverviewRange, dayKeyOf } from '@perfscope/shared';

/** The shorthands the picker offers beside the calendar — the three windows the dashboard
 *  has always had, now as presets rather than as the only choice. */
const PRESETS = OVERVIEW_WINDOWS.map(days => ({ days, label: `${days} days` }));


/** The site select needs a value for "no filter", and Radix treats an empty string as
 *  "nothing selected" — which renders the placeholder instead of the option. */
const ALL_SITES = 'all';

/** Placeholders that occupy the same space as the real strip and panels, so a slow
 *  overview reads as loading rather than as a page that drew nothing. */
function TotalsStripSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-[14px] mb-[22px] max-sm:grid-cols-2">
      {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[78px] rounded-[16px]" />)}
    </div>
  );
}

function PanelSkeleton({ className }: { className: string }) {
  return <Skeleton className={`w-full rounded-[16px] ${className}`} />;
}

/** One entrance for every section, staggered by call order — the page used to appear all
 *  at once, which reads as static no matter how much is actually on it. `y` first is
 *  intentional: the identical rhythm compare's own sections settled on (§ ComparisonPage). */
const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut' as const, delay },
});

/**
 * The account at a glance — the first screen after logging in.
 *
 * The wide charts lead — trend, cadence, and where the runs land — because they are the
 * only view of the account as a whole; the paired cards below drill into what to act on.
 * The analyzer stays one click away in the sidebar; "audit this URL" is rarely the first
 * question of the day.
 */
export function DashboardPage() {
  /**
   * The window and the site live in the address, not in a store.
   *
   * They describe *what is on screen*, which makes the page linkable — "here is our slow
   * site over ninety days" is a URL someone can paste — and it survives a reload without
   * anything having to remember it. Unlike the analyzer's `?url=`, these ask for no work:
   * they are read on every render rather than consumed once.
   */
  const [params, setParams] = useSearchParams();
  // Resolved by the *shared* helper, the same one the server runs on the query it receives
  // — so the label above the charts names the window the numbers were actually counted in,
  // including when a hand-edited URL gets clamped.
  const range = resolveOverviewRange({
    days: params.get('days'),
    from: params.get('from'),
    to:   params.get('to'),
  });
  const siteId = params.get('site') ?? '';

  const today = dayKeyOf(new Date());
  /** What the window is called wherever it is named — "30 days" for a preset, the two
   *  dates for anything else. One label, so the strip and the charts cannot disagree. */
  const windowLabel = rangeLabel(range, PRESETS, today);

  const { websites } = useWebsites();
  const { data, isPending } = useOverview(range, siteId || undefined);
  const [modalOpen, setModalOpen] = useState(false);

  function setParams_(changes: Record<string, string | null>) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value); else next.delete(key);
      }
      return next;
    }, { replace: true });
  }

  /** A preset is "the last N days", which is what `?days=` means — so the explicit pair
   *  goes, or the two would disagree and the pair would win. */
  const choosePreset = (days: number) => setParams_({
    days: days === DEFAULT_OVERVIEW_WINDOW ? null : String(days),
    from: null,
    to:   null,
  });

  const chooseRange = (from: string, to: string) => setParams_({ days: null, from, to });

  // Both charts in the top row take the fixed height together, or neither does: sizing
  // them independently is what put a 340px panel next to a 90px one in the first place,
  // and a brand-new account should not open onto a screen of tall empty boxes.
  const gettingStarted = useGettingStartedVisible();
  const chartsTall = !!data && (hasTrendData(data.charts.trend) || hasVitalsData(data.charts.vitals));

  return (
    <Page>
      <PageHeader
        eyebrow="Dashboard"
        title="Overview"
        description="What broke, what slipped, and what has been measured lately — across every site."
        actions={
          <Link
            to="/app"
            className="inline-flex items-center gap-[9px] font-bold text-[14.5px] px-5 py-3 rounded-[12px]
                       bg-ld-grad text-ld-grad-text shadow-ld-glow border-0
                       transition-transform duration-[150ms] hover:-translate-y-px"
          >
            <Plus className="w-[17px] h-[17px]" /> New Audit
          </Link>
        }
      />

      {/* Above everything, because every number below is an answer to these two questions.
          The site picker only appears once there is more than one site to choose between —
          a filter with a single option is a control that cannot do anything. */}
      <div className="flex items-center gap-[10px] flex-wrap mb-[18px]">
        <DateRangePicker
          range={range}
          presets={PRESETS}
          onPreset={choosePreset}
          onRange={chooseRange}
        />
        {websites.length > 1 && (
          <Select
            value={siteId || ALL_SITES}
            onValueChange={(v) => setParams_({ site: v === ALL_SITES ? null : v })}
          >
            {/* A row of buttons was fine at two sites and unusable at ten — it wrapped onto
                its own line and pushed the whole page down. A select is one control whose
                width does not depend on how many sites somebody tracks. */}
            <SelectTrigger
              aria-label="Site filter"
              className="w-auto min-w-[150px] max-w-[240px] h-[32px] gap-[7px] rounded-[10px]
                         border-ld-border bg-ld-surface text-[12.5px] font-semibold text-ld-text-2
                         hover:border-ld-border-strong hover:text-ld-text shadow-none"
            >
              <Globe className="w-[14px] h-[14px] shrink-0 text-ld-text-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-ld-surface border-ld-border max-h-[280px]">
              <SelectItem
                value={ALL_SITES}
                className="text-[12.5px] cursor-pointer text-ld-text focus:bg-ld-accent-soft focus:text-ld-accent"
              >
                All sites
              </SelectItem>
              {websites.map(w => (
                <SelectItem
                  key={w._id}
                  value={w._id}
                  className="text-[12.5px] font-mono cursor-pointer text-ld-text focus:bg-ld-accent-soft focus:text-ld-accent"
                >
                  {getHostname(w.url)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* One "what to do next" block at a time. While the checklist is up it is the better
          of the two — its steps are buttons that do the thing — and the advisor panel on
          the right still carries the AI voice. */}
      {!gettingStarted && (
        <motion.div {...fadeUp(0)}>
          <NextStepCard />
        </motion.div>
      )}

      {/* The strip is the page's anchor. While the request is in flight its skeleton holds
          the same space — rendering nothing at all made a slow response look like a page
          that had failed to draw. Skeletons don't get the entrance — a placeholder easing
          in reads as an animation glitch, not as progress. */}
      {data ? (
        <motion.div {...fadeUp(0.05)}>
          <TotalsStrip totals={data.totals} days={range.days} label={windowLabel} />
        </motion.div>
      ) : isPending ? <TotalsStripSkeleton /> : null}

      {/* First-run path. Renders nothing once every step is done, or if dismissed. */}
      <GettingStartedPanel onAddWebsite={() => setModalOpen(true)} />

      {isPending && !data ? (
        <div className="flex flex-col gap-[20px] mt-[20px]">
          <PanelSkeleton className="h-[260px]" />
          <PanelSkeleton className="h-[200px]" />
        </div>
      ) : !data ? (
        <StatePanel
          variant="error"
          title="Overview unavailable"
          description={
            <>
              The summary could not be loaded. Everything else still works —{' '}
              <Link to="/websites" className="font-semibold text-ld-accent hover:underline">
                go to your websites
              </Link>
              .
            </>
          }
        />
      ) : (
        <div className="flex flex-col gap-[20px]">

          {/* One rhythm for the whole page: every row is a pair of equal-height panels on
              a 12-column grid, and each row is only as tall as it needs to be. Panels used
              to be stacked full width at whatever height their own content produced — 352,
              then 235, then 272 — with a short card parked beside a tall one leaving a
              hole where a panel should be. */}
          <div className="grid grid-cols-12 gap-[18px] max-[1100px]:grid-cols-1">

            {/* Trend leads, and takes the wider half: it carries thirty days on the x axis
                against the split's three rows. Both are pinned to the same height. */}
            <motion.div {...fadeUp(0.1)} className="col-span-7 max-[1100px]:col-span-1">
              <Panel className={cn('flex flex-col h-full', chartsTall && 'h-[340px]')}>
                <PanelHeader
                  icon={<TrendingUp />}
                  title="Performance over time"
                  meta={windowLabel}
                />
                <PanelBody className="flex-1 min-h-0">
                  <ScoreTrendChart trend={data.charts.trend} days={data.charts.days} />
                </PanelBody>
              </Panel>
            </motion.div>

            <motion.div {...fadeUp(0.15)} className="col-span-5 max-[1100px]:col-span-1">
              <Panel className={cn('flex flex-col h-full', chartsTall && 'h-[340px]')}>
                <PanelHeader
                  icon={<BarChart3 />}
                  title="Where the runs land"
                  meta="all audits in window"
                />
                <PanelBody className="flex-1 min-h-0">
                  <VitalsSplitChart vitals={data.charts.vitals} />
                </PanelBody>
              </Panel>
            </motion.div>

            {/* Full width, and short: thirty daily bars in half a row compress into noise,
                but the bars themselves carry one number each and need no more height. */}
            <motion.div {...fadeUp(0.2)} className="col-span-12 max-[1100px]:col-span-1">
              <Panel className={cn('flex flex-col', hasActivityData(data.charts.activity) && 'h-[228px]')}>
                <PanelHeader
                  icon={<CalendarDays />}
                  title="Audit activity"
                  meta={windowLabel}
                />
                <PanelBody className="flex-1 min-h-0 flex flex-col">
                  <ActivityChart activity={data.charts.activity} days={data.charts.days} />
                </PanelBody>
              </Panel>
            </motion.div>

            {/* The four cards hold wildly different row counts. Each pair shares a row
                height and the longer list scrolls inside its panel, so neither a hole nor
                a page that scrolls for a screen and a half. The cap only binds when there
                is enough to fill it — an empty account still gets short cards. */}
            <motion.div {...fadeUp(0.25)} className="col-span-6 max-[1100px]:col-span-1">
              <IncidentsCard incidents={data.incidents} className="h-full max-h-[420px]" />
            </motion.div>
            <motion.div {...fadeUp(0.3)} className="col-span-6 max-[1100px]:col-span-1">
              <AttentionCard rows={data.attention} className="h-full max-h-[420px]" />
            </motion.div>

            <motion.div {...fadeUp(0.35)} className="col-span-6 max-[1100px]:col-span-1">
              <RecentAuditsCard audits={data.recentAudits} className="h-full max-h-[380px]" />
            </motion.div>
            <motion.div {...fadeUp(0.4)} className="col-span-6 max-[1100px]:col-span-1">
              <RumPulseCard rum={data.rum} className="h-full max-h-[380px]" />
            </motion.div>
          </div>
        </div>
      )}

      <AddWebsiteModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </Page>
  );
}
