import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, CalendarDays, BarChart3, Plus } from 'lucide-react';
import { GettingStartedPanel } from '@/features/onboarding';
import { AddWebsiteModal } from '@/features/websites/ui/AddWebsiteModal';
import { Panel, PanelHeader, PanelBody } from '@/shared/ui/panel';
import { useOverview } from '@/features/overview/model/useOverview';
import { TotalsStrip } from '@/features/overview/ui/TotalsStrip';
import { IncidentsCard } from '@/features/overview/ui/IncidentsCard';
import { AttentionCard } from '@/features/overview/ui/AttentionCard';
import { RecentAuditsCard } from '@/features/overview/ui/RecentAuditsCard';
import { RumPulseCard } from '@/features/overview/ui/RumPulseCard';
import { ScoreTrendChart } from '@/features/overview/ui/ScoreTrendChart';
import { ActivityChart } from '@/features/overview/ui/ActivityChart';
import { VitalsSplitChart } from '@/features/overview/ui/VitalsSplitChart';
import { StatePanel } from '@/shared/ui/state-panel';
import { Skeleton } from '@/shared/ui/skeleton';

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

  return (
    <div className="w-[min(1180px,100%)] mx-auto px-[clamp(22px,4vw,48px)] pt-[34px] pb-20">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-5 flex-wrap mb-[28px]">
        <div>
          <p className="font-mono text-[12px] tracking-[.16em] uppercase text-ld-accent font-semibold">
            Dashboard
          </p>
          <h1 className="text-[clamp(26px,3.4vw,34px)] font-extrabold tracking-[-0.03em] mt-2 text-ld-text">
            Overview
          </h1>
          <p className="text-[14.5px] text-ld-text-2 mt-[6px]">
            What broke, what slipped, and what has been measured lately — across every site.
          </p>
        </div>
        <Link
          to="/app"
          className="inline-flex items-center gap-[9px] font-bold text-[14.5px] px-5 py-3 rounded-[12px]
                     bg-ld-grad text-ld-grad-text shadow-ld-glow border-0
                     transition-transform duration-[150ms] hover:-translate-y-px"
        >
          <Plus className="w-[17px] h-[17px]" /> New Audit
        </Link>
      </div>

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

          {/* Trend leads: the shape over time is the one thing no other page shows. */}
          <Panel>
            <PanelHeader
              icon={<TrendingUp />}
              title="Performance over time"
              meta={`last ${data.charts.days} days`}
            />
            <PanelBody>
              <ScoreTrendChart trend={data.charts.trend} days={data.charts.days} />
            </PanelBody>
          </Panel>

          {/* Full width: thirty daily bars in half a row compress into noise, and the
              gaps between runs are the whole point of this chart. */}
          <Panel>
            <PanelHeader
              icon={<CalendarDays />}
              title="Audit activity"
              meta={`last ${data.charts.days} days`}
            />
            <PanelBody>
              <ActivityChart activity={data.charts.activity} days={data.charts.days} />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              icon={<BarChart3 />}
              title="Where the runs land"
              meta="all audits in window"
            />
            <PanelBody>
              <VitalsSplitChart vitals={data.charts.vitals} />
            </PanelBody>
          </Panel>

          {/* The two "act now" blocks, side by side. items-start on both pairs: these
              cards hold wildly different row counts, and stretching the shorter one
              leaves a half-empty panel that reads as a loading failure. */}
          <div className="grid grid-cols-2 gap-[18px] items-start max-[1100px]:grid-cols-1">
            <IncidentsCard incidents={data.incidents} />
            <AttentionCard rows={data.attention} trend={data.charts.trend} />
          </div>

          {/* The RUM card is a single line; stretching it to the height of the audit log
              left a panel of empty space beside it. */}
          <div className="grid grid-cols-2 gap-[18px] items-start max-[1100px]:grid-cols-1">
            <RecentAuditsCard audits={data.recentAudits} />
            <RumPulseCard rum={data.rum} />
          </div>
        </div>
      )}

      <AddWebsiteModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
