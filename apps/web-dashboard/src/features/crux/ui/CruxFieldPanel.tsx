import { Users } from 'lucide-react';
import { GlossaryTip } from '@/entities/analysis';
import { Panel, PanelHeader } from '@/shared/ui/panel';
import type { CruxData, CruxMetric, CruxMetricKey } from '@perfscope/shared';
import {
  CRUX_METRICS,
  CRUX_METRIC_ORDER,
  RATING_TEXT,
  RATING_LABEL,
  fmtCollectionDate,
} from '../lib/metrics';

const pct = (share: number): number => Math.round(share * 100);

// ─── Distribution bar ─────────────────────────────────────────────────────────

/**
 * Good / needs-improvement / poor split of real page loads.
 * Drawn as an SVG so the segment widths are geometry attributes — the repo's
 * styling policy keeps colours in --ld-* tokens and out of inline styles.
 */
function DistributionBar({ metric, label }: { metric: CruxMetric; label: string }) {
  const total = metric.good + metric.needsImprovement + metric.poor;
  const scale = total > 0 ? 100 / total : 0;
  const good  = metric.good * scale;
  const needs = metric.needsImprovement * scale;
  const poor  = Math.max(0, 100 - good - needs);

  return (
    <span
      className="block h-[6px] w-full rounded-full overflow-hidden bg-ld-surface-2"
      role="img"
      aria-label={`${label}: ${pct(metric.good)}% good, ${pct(metric.needsImprovement)}% needs improvement, ${pct(metric.poor)}% poor`}
    >
      <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="block w-full h-full">
        <rect x={0} y={0} width={good} height={6} className="fill-ld-accent" />
        <rect x={good} y={0} width={needs} height={6} className="fill-ld-amber" />
        <rect x={good + needs} y={0} width={poor} height={6} className="fill-ld-rose" />
      </svg>
    </span>
  );
}

// ─── Metric row ───────────────────────────────────────────────────────────────

function MetricRow({ metricKey, metric }: { metricKey: CruxMetricKey; metric: CruxMetric }) {
  const meta   = CRUX_METRICS[metricKey];
  const rating = meta.rate(metric.p75);

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-baseline gap-[10px]">
        <b className="font-mono text-[11px] tracking-[.08em] uppercase text-ld-text-2 font-semibold w-[42px] shrink-0">
          {meta.label}
        </b>
        <GlossaryTip term={metricKey} />
        <span className="text-[12px] text-ld-text-3 flex-1 min-w-0 truncate">{meta.title}</span>
        <span className={`font-mono text-[14px] font-semibold tabular-nums ${RATING_TEXT[rating]}`}>
          {meta.format(metric.p75)}
        </span>
        <span className="text-[11px] text-ld-text-3 w-[112px] text-right shrink-0 max-[540px]:hidden">
          {RATING_LABEL[rating]} · p75
        </span>
      </div>

      <DistributionBar metric={metric} label={meta.label} />

      <div className="flex items-center gap-[14px] font-mono text-[10.5px] tabular-nums text-ld-text-3">
        <span className="text-ld-accent">{pct(metric.good)}%</span>
        <span className="text-ld-amber">{pct(metric.needsImprovement)}%</span>
        <span className="text-ld-rose">{pct(metric.poor)}%</span>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export interface CruxFieldPanelProps {
  /** `null` means CrUX has nothing for this page (or the backend has no API key). */
  data:       CruxData | null | undefined;
  isLoading?: boolean;
  /**
   * Render the "no field data" explainer instead of nothing when `data` is null.
   * Off by default so an always-mounted panel stays invisible when there is
   * nothing real to report next to the lab numbers.
   */
  showEmpty?: boolean;
  className?: string;
}

export function CruxFieldPanel({ data, isLoading = false, showEmpty = false, className }: CruxFieldPanelProps) {
  if (isLoading) {
    return (
      <Panel className={className}>
        <PanelHeader icon={<Users />} title="Field data · Chrome UX Report" meta="loading" />
        <div className="px-[18px] py-[16px] flex flex-col gap-[14px]">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-[6px] w-full rounded-full bg-ld-surface-2 animate-pulse" />
          ))}
        </div>
      </Panel>
    );
  }

  if (!data) {
    if (!showEmpty) return null;
    return (
      <Panel className={className}>
        <PanelHeader icon={<Users />} title="Field data · Chrome UX Report" />
        <div className="px-[18px] py-[16px] flex flex-col gap-[8px]">
          <p className="text-[13px] text-ld-text-2 leading-relaxed">
            No real-user data for this page.
          </p>
          <p className="text-[12px] text-ld-text-3 leading-relaxed">
            The Chrome UX Report only publishes a page or origin once enough real Chrome
            users have visited it for the numbers to be statistically meaningful, so new,
            private, or low-traffic sites never appear. The Lighthouse scores above are
            lab measurements and stand on their own.
          </p>
        </div>
      </Panel>
    );
  }

  const entries = CRUX_METRIC_ORDER
    .map((key) => [key, data.metrics[key]] as const)
    .filter((pair): pair is readonly [CruxMetricKey, CruxMetric] => Boolean(pair[1]));

  if (entries.length === 0) return null;

  const from   = fmtCollectionDate(data.collectedFrom);
  const to     = fmtCollectionDate(data.collectedTo);
  const period = from && to ? `${from} – ${to}` : '';

  return (
    <Panel className={className}>
      <PanelHeader icon={<Users />} title="Field data · Chrome UX Report" meta={period || undefined}>
        <span className="ml-[10px] px-[9px] py-[3px] rounded-full text-[10.5px] font-semibold uppercase tracking-[.06em] bg-ld-accent-soft text-ld-accent border border-ld-accent-line shrink-0">
          {data.scope === 'url' ? 'This page' : 'Origin'}
        </span>
      </PanelHeader>

      <div className="px-[18px] py-[16px] flex flex-col gap-[18px]">
        <p className="text-[12px] text-ld-text-3 leading-relaxed">
          What real Chrome users measured on {data.formFactor === 'desktop' ? 'desktop' : 'mobile'}
          {data.scope === 'origin'
            ? ' across this whole origin — CrUX has no page-level sample for this exact URL.'
            : ' on this exact page.'}
          {' '}Each bar is the share of visits rated good, needs improvement, and poor.
        </p>

        {entries.map(([key, metric]) => (
          <MetricRow key={key} metricKey={key} metric={metric} />
        ))}
      </div>
    </Panel>
  );
}
