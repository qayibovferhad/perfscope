import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, CalendarDays, BarChart3, Plus } from 'lucide-react';
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

/**
 * The account at a glance — the first screen after logging in.
 *
 * The wide charts lead — trend, cadence, and where the runs land — because they are the
 * only view of the account as a whole; the paired cards below drill into what to act on.
 * The analyzer stays one click away in the sidebar; "audit this URL" is rarely the first
 * question of the day.
 */
export function DashboardPage() {
  const { data, isPending } = useOverview();
  const [modalOpen, setModalOpen] = useState(false);

  // Both charts in the top row take the fixed height together, or neither does: sizing
  // them independently is what put a 340px panel next to a 90px one in the first place,
  // and a brand-new account should not open onto a screen of tall empty boxes.
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

      {/* The strip is the page's anchor. While the request is in flight its skeleton holds
          the same space — rendering nothing at all made a slow response look like a page
          that had failed to draw. */}
      {data ? <TotalsStrip totals={data.totals} /> : isPending ? <TotalsStripSkeleton /> : null}

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
            <Panel className={cn('col-span-7 flex flex-col max-[1100px]:col-span-1', chartsTall && 'h-[340px]')}>
              <PanelHeader
                icon={<TrendingUp />}
                title="Performance over time"
                meta={`last ${data.charts.days} days`}
              />
              <PanelBody className="flex-1 min-h-0">
                <ScoreTrendChart trend={data.charts.trend} days={data.charts.days} />
              </PanelBody>
            </Panel>

            <Panel className={cn('col-span-5 flex flex-col max-[1100px]:col-span-1', chartsTall && 'h-[340px]')}>
              <PanelHeader
                icon={<BarChart3 />}
                title="Where the runs land"
                meta="all audits in window"
              />
              <PanelBody className="flex-1 min-h-0">
                <VitalsSplitChart vitals={data.charts.vitals} />
              </PanelBody>
            </Panel>

            {/* Full width, and short: thirty daily bars in half a row compress into noise,
                but the bars themselves carry one number each and need no more height. */}
            <Panel className={cn('col-span-12 flex flex-col max-[1100px]:col-span-1', hasActivityData(data.charts.activity) && 'h-[228px]')}>
              <PanelHeader
                icon={<CalendarDays />}
                title="Audit activity"
                meta={`last ${data.charts.days} days`}
              />
              <PanelBody className="flex-1 min-h-0 flex flex-col">
                <ActivityChart activity={data.charts.activity} days={data.charts.days} />
              </PanelBody>
            </Panel>

            {/* The four cards hold wildly different row counts. Each pair shares a row
                height and the longer list scrolls inside its panel, so neither a hole nor
                a page that scrolls for a screen and a half. The cap only binds when there
                is enough to fill it — an empty account still gets short cards. */}
            <IncidentsCard incidents={data.incidents} className="col-span-6 max-h-[420px] max-[1100px]:col-span-1" />
            <AttentionCard  rows={data.attention}     className="col-span-6 max-h-[420px] max-[1100px]:col-span-1" />

            <RecentAuditsCard audits={data.recentAudits} className="col-span-6 max-h-[380px] max-[1100px]:col-span-1" />
            <RumPulseCard     rum={data.rum}            className="col-span-6 max-h-[380px] max-[1100px]:col-span-1" />
          </div>
        </div>
      )}

      <AddWebsiteModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </Page>
  );
}
