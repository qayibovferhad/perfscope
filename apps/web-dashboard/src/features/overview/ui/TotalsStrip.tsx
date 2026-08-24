import { LayoutGrid, Activity, AlertTriangle, Gauge } from 'lucide-react';
import type { OverviewTotals } from '@perfscope/shared';
import { StatCard } from '@/shared/ui/stat-card';

/**
 * The four numbers worth knowing before deciding what to do next.
 *
 * `avgScore` and `needsAttention` are computed by the same backend helper the websites
 * summary strip uses, so the two screens cannot disagree about what a site scores.
 */
export function TotalsStrip({ totals, days, label }: {
  totals: OverviewTotals;
  days: number;
  /** How the window is named on this page — passed in rather than derived, because a range
   *  picked as two dates has no "N days" name worth showing beside a count. */
  label?: string;
}) {
  // Two across on a phone, not one. Four full-width cards carrying one number each were
  // most of a screen of scrolling before the page said anything; paired, the whole strip
  // is a glance and the numbers are still large enough to read.
  return (
    <div className="grid grid-cols-4 gap-[14px] mb-[26px] max-[1000px]:grid-cols-2">
      <StatCard
        label="Sites tracked"
        value={totals.sites}
        icon={<LayoutGrid className="w-5 h-5" />}
      />
      <StatCard
        label={totals.audited ? `Avg score · ${totals.audited} audited` : 'Avg score'}
        value={totals.audited ? totals.avgScore : '—'}
        icon={<Gauge className="w-5 h-5" />}
      />
      <StatCard
        // Named after the window on screen. "Audits this week" beside a 90-day range is a
        // label that quietly contradicts the control the reader just used.
        // Named after the window the picker shows, whatever shape it has — "7 days" for a
        // preset, "3 Aug – 19 Aug" for a range. The old "Audits this week" special case went
        // with the three-button control: it read well and stopped being true the moment a
        // window could end anywhere but today.
        label={`Audits · ${label ?? `${days} days`}`}
        value={totals.auditsInWindow}
        icon={<Activity className="w-5 h-5" />}
      />
      <StatCard
        label="Sites below 50"
        value={totals.needsAttention}
        icon={<AlertTriangle className="w-5 h-5" />}
      />
    </div>
  );
}
