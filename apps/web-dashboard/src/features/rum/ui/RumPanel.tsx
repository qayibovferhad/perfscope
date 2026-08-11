import { useState } from 'react';
import { Activity, Loader2, RefreshCw } from 'lucide-react';
import type { RumMetricKey, RumMetricSummary, RumSummary, RumPathRow } from '@perfscope/shared';
import {
  FIELD_METRICS, FIELD_METRIC_ORDER, RATING_TEXT, RATING_LABEL, GlossaryTip,
  type AuditFormFactor,
} from '@/entities/analysis';
import { Panel, PanelHeader } from '@/shared/ui/panel';
import { Button } from '@/shared/ui/button';
import { Segmented } from '@/shared/ui/segmented';
import { CopySnippet } from '@/shared/ui/copy-snippet';
import { Monitor, Smartphone, Globe } from 'lucide-react';
import { useRum, useRumTrend, useIssueRumKey } from '../model/useRum';
import { RumTrendChart } from './RumTrendChart';

const pct = (n: number) => Math.round(n * 100);

function DistributionBar({ metric, label }: { metric: RumMetricSummary; label: string }) {
  const good  = pct(metric.good);
  const needs = pct(metric.needsImprovement);
  const poor  = Math.max(0, 100 - good - needs);

  return (
    <span
      className="block h-[6px] w-full rounded-full overflow-hidden bg-ld-surface-2"
      role="img"
      aria-label={`${label}: ${good}% good, ${needs}% needs improvement, ${poor}% poor`}
    >
      <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="block w-full h-full">
        <rect x={0} y={0} width={good} height={6} className="fill-ld-accent" />
        <rect x={good} y={0} width={needs} height={6} className="fill-ld-amber" />
        <rect x={good + needs} y={0} width={poor} height={6} className="fill-ld-rose" />
      </svg>
    </span>
  );
}

function MetricRow({ metricKey, metric, lab }: {
  metricKey: RumMetricKey;
  metric:    RumMetricSummary;
  /** The same metric from the most recent lab audit, when it has one. */
  lab?:      number | undefined;
}) {
  const meta   = FIELD_METRICS[metricKey];
  const rating = meta.rate(metric.p75);

  // The gap is the point of the panel: a lab run on a fast machine routinely reports a
  // number your users never see. Only flagged when it is large enough to act on.
  const ratio = lab && lab > 0 ? metric.p75 / lab : null;
  const gap   = ratio !== null && ratio >= 1.5 ? `${ratio.toFixed(1)}×` : null;

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-baseline gap-[10px]">
        <b className="font-mono text-[11px] tracking-[.08em] uppercase text-ld-text-2 font-semibold w-[42px] shrink-0">
          {meta.label}
        </b>
        <GlossaryTip term={metricKey} />
        <span className="text-[12px] text-ld-text-3 flex-1 min-w-0 truncate max-[720px]:hidden">
          {meta.title}
        </span>

        {lab !== undefined && (
          <span className="font-mono text-[12px] tabular-nums text-ld-text-3 shrink-0" title="Latest lab audit">
            lab {meta.format(lab)}
          </span>
        )}
        {gap && (
          <span className="font-mono text-[10.5px] font-semibold text-ld-amber shrink-0" title="Field is this much slower than the lab run">
            {gap}
          </span>
        )}

        <span className={`font-mono text-[14px] font-semibold tabular-nums shrink-0 ${RATING_TEXT[rating]}`}>
          {meta.format(metric.p75)}
        </span>
        <span className="text-[11px] text-ld-text-3 w-[132px] text-right shrink-0 max-[540px]:hidden">
          {RATING_LABEL[rating]} · p75 of {metric.samples}
        </span>
      </div>

      <DistributionBar metric={metric} label={meta.label} />
    </div>
  );
}

function PathTable({ paths }: { paths: RumPathRow[] }) {
  if (paths.length === 0) return null;
  return (
    <div className="border-t border-ld-border pt-[14px]">
      <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ld-text-3 mb-[10px]">
        Busiest pages
      </p>
      <div className="flex flex-col gap-[6px]">
        {paths.map(row => (
          <div key={row.path} className="flex items-baseline gap-[10px] text-[12.5px]">
            <span className="font-mono text-ld-text-2 flex-1 min-w-0 truncate">{row.path}</span>
            <span className="font-mono text-ld-text-3 tabular-nums">
              {row.lcp === null ? '—' : FIELD_METRICS.lcp.format(row.lcp)}
            </span>
            <span className="font-mono text-ld-text-3 tabular-nums w-[62px] text-right">
              {row.pageViews} view{row.pageViews === 1 ? '' : 's'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shown until the first beacon arrives — the snippet is the whole setup. */
function InstallGuide({ apiOrigin, rumKey, onIssue, isIssuing }: {
  apiOrigin: string;
  rumKey:    string | null;
  onIssue:   () => void;
  isIssuing: boolean;
}) {
  if (!rumKey) {
    return (
      <div className="flex flex-col items-start gap-[12px]">
        <p className="text-[13px] text-ld-text-2 leading-[1.55]">
          Lab audits measure one synthetic load. Field data is what your visitors actually
          got — every browser, every connection, including pages behind a login that no
          public dataset can see. Add one script tag to start collecting.
        </p>
        <Button size="md" onClick={onIssue} disabled={isIssuing}>
          {isIssuing ? <Loader2 className="animate-spin" /> : <Activity />}
          Generate snippet
        </Button>
      </div>
    );
  }

  const snippet =
    `<script defer src="${apiOrigin}/rum.js" data-perfscope-key="${rumKey}"></script>`;

  return (
    <div className="flex flex-col gap-[12px]">
      <p className="text-[13px] text-ld-text-2 leading-[1.55]">
        Paste this into your site&apos;s <code className="font-mono text-ld-text-3">&lt;head&gt;</code>.
        Measurements are sent once per page view, as the visitor leaves.
      </p>
      <CopySnippet text={snippet} />
      <p className="text-[11.5px] text-ld-text-3 leading-[1.5]">
        The key is public by design — it only says which site a measurement belongs to.
        No cookies, no identifiers, and only the path is recorded, never the query string.
      </p>
    </div>
  );
}

const DEVICE_FILTER = [
  { value: 'all'     as const, label: 'All',     icon: Globe,      title: 'Every visitor' },
  { value: 'desktop' as const, label: 'Desktop', icon: Monitor,    title: 'Viewports 768px and wider' },
  { value: 'mobile'  as const, label: 'Mobile',  icon: Smartphone, title: 'Viewports under 768px' },
];

const RANGES = [
  { value: '1'  as const, label: '24h', icon: Activity, title: 'Last 24 hours' },
  { value: '7'  as const, label: '7d',  icon: Activity, title: 'Last 7 days' },
  { value: '30' as const, label: '30d', icon: Activity, title: 'Last 30 days' },
];

/**
 * The snippet must point at the backend directly, not at the dashboard's dev proxy —
 * it runs on the customer's site, where /api resolves to their own server. Same origin
 * the socket client uses.
 */
const API_ORIGIN = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3101').replace(/\/$/, '');

export interface LabMetrics {
  lcp?: number;
  cls?: number;
  fcp?: number;
}

interface Props {
  websiteId: string;
  /**
   * Metrics from the most recent lab audit, for the side-by-side. Only the three the two
   * views share — INP and TTFB have no lab equivalent, and TBT is a different metric
   * from INP however tempting the analogy.
   */
  lab?: LabMetrics | null;
}

export function RumPanel({ websiteId, lab }: Props) {
  const apiOrigin = API_ORIGIN;
  const [days,   setDays]   = useState<'1' | '7' | '30'>('7');
  const [device, setDevice] = useState<AuditFormFactor | 'all'>('all');

  const [trendMetric, setTrendMetric] = useState<RumMetricKey>('lcp');

  // isLoading, not isPending: the query is gated on `enabled: Boolean(websiteId)`, and a
  // disabled query stays `pending` forever in React Query v5 — an empty id would pin this
  // panel on "Loading field data…" with nothing in flight.
  const { data, isLoading } = useRum({ websiteId, days: Number(days), device });
  const trend = useRumTrend({ websiteId, metric: trendMetric, days: Number(days), device });
  const issue = useIssueRumKey(websiteId);

  const summary: RumSummary | undefined = data?.summary;
  const hasData = (summary?.pageViews ?? 0) > 0;

  return (
    <Panel>
      <PanelHeader
        icon={<Activity />}
        title="Field data · your visitors"
        meta={hasData ? `${summary!.pageViews} page view${summary!.pageViews === 1 ? '' : 's'}` : undefined}
      >
        {hasData && (
          <div className="flex items-center gap-[8px] ml-auto max-[680px]:hidden">
            <Segmented options={RANGES} value={days} onChange={setDays} ariaLabel="Time range" />
            <Segmented options={DEVICE_FILTER} value={device} onChange={setDevice} ariaLabel="Device" />
          </div>
        )}
      </PanelHeader>

      <div className="p-[18px] flex flex-col gap-[16px]">
        {isLoading && (
          <div className="flex items-center gap-2 text-[13px] text-ld-text-3">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading field data…
          </div>
        )}

        {!isLoading && !hasData && (
          <InstallGuide
            apiOrigin={apiOrigin}
            rumKey={data?.rumKey ?? null}
            onIssue={() => issue.mutate()}
            isIssuing={issue.isPending}
          />
        )}

        {!isLoading && hasData && (
          <>
            <div className="flex flex-col gap-[14px]">
              {FIELD_METRIC_ORDER.map(key => {
                const metric = summary!.metrics[key as RumMetricKey];
                if (!metric) return null;
                const labValue = lab?.[key as keyof LabMetrics];
                return (
                  <MetricRow
                    key={key}
                    metricKey={key as RumMetricKey}
                    metric={metric}
                    {...(typeof labValue === 'number' ? { lab: labValue } : {})}
                  />
                );
              })}
            </div>

            <div className="border-t border-ld-border pt-[14px]">
              <div className="flex items-center justify-between gap-[12px] mb-[8px] flex-wrap">
                <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ld-text-3">Daily p75</p>
                <div className="flex gap-[4px]">
                  {FIELD_METRIC_ORDER.map(key => {
                    if (!summary!.metrics[key as RumMetricKey]) return null;
                    const active = trendMetric === key;
                    return (
                      <button key={key} type="button" onClick={() => setTrendMetric(key as RumMetricKey)}
                        className={`font-mono text-[10.5px] font-semibold px-[8px] py-[3px] rounded-[6px] transition-colors ${
                          active ? 'bg-ld-accent-soft text-ld-accent-2' : 'text-ld-text-3 hover:text-ld-text-2'}`}>
                        {FIELD_METRICS[key].label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Checking only `trend.data` left a failed request saying "Loading trend…"
                  indefinitely — the three outcomes have to be told apart. */}
              {trend.data ? (
                <RumTrendChart trend={trend.data} />
              ) : trend.isError ? (
                <p className="text-[12px] text-ld-rose py-[10px]">Could not load the trend.</p>
              ) : (
                <p className="text-[12px] text-ld-text-3 py-[10px]">
                  {trend.isLoading ? 'Loading trend…' : 'No trend data yet.'}
                </p>
              )}
            </div>

            <PathTable paths={data?.paths ?? []} />

            {data?.rumKey && (
              <details className="border-t border-ld-border pt-[14px]">
                <summary className="text-[12px] text-ld-text-3 cursor-pointer inline-flex items-center gap-[6px]">
                  <RefreshCw className="w-[12px] h-[12px]" /> Snippet
                </summary>
                <div className="mt-[12px]">
                  <InstallGuide
                    apiOrigin={apiOrigin}
                    rumKey={data.rumKey}
                    onIssue={() => issue.mutate()}
                    isIssuing={issue.isPending}
                  />
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
