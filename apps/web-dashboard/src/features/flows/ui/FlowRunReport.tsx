import { Activity, Camera, MousePointerClick } from 'lucide-react';
import {
  FLOW_MODE_METRICS, fmtMs, fmtCls,
  type FlowStepMode, type FlowStepResult, type FlowRunResult,
} from '@perfscope/shared';
import { Panel, PanelHeader, PanelBody } from '@/shared/ui/panel';
import { scoreBand, vitalBand, BAND_TEXT, BAND_TILE } from '@/entities/analysis';

/**
 * A flow report: one card per measured step.
 *
 * Every card asks what its own mode can answer and nothing else. Lighthouse hands back a
 * full report for each step, most of which is meaningless outside the mode that produced
 * it — a snapshot's `performance: 0` is not a score, it is the absence of one — so the
 * server already dropped what does not apply (`flow-transform.ts`) and this draws only what
 * survived. An empty cell here means "this mode does not measure that", which is why the
 * cells are labelled rather than laid out in a fixed grid.
 */

const MODE_ICON: Record<FlowStepMode, typeof Activity> = {
  navigation: Activity,
  timespan:   MousePointerClick,
  snapshot:   Camera,
};

const MODE_LABEL: Record<FlowStepMode, string> = {
  navigation: 'Page load',
  timespan:   'Interaction',
  snapshot:   'Final state',
};

/** What each mode is *for*, said once per card. Without it a reader wonders why the
 *  interaction has no LCP and assumes something failed. */
const MODE_NOTE: Record<FlowStepMode, string> = {
  navigation: 'The cold load, measured exactly as an ordinary audit measures it.',
  timespan:   'The response to this interaction — INP is input to next paint.',
  snapshot:   'The page as it stands now. No timing: nothing was loading.',
};

const METRIC_LABEL: Record<string, string> = {
  inp: 'INP', tbt: 'TBT', cls: 'CLS', lcp: 'LCP', fcp: 'FCP', si: 'Speed Index', tti: 'TTI',
};

const CATEGORY_LABEL: Record<string, string> = {
  performance: 'Performance', accessibility: 'Accessibility', bestPractices: 'Best practices', seo: 'SEO',
};

const formatMetric = (key: string, value: number) => (key === 'cls' ? fmtCls(value) : fmtMs(value));

/** INP has no entry in the shared vitals thresholds used for lab metrics, so it is banded
 *  here against the same numbers the field panels use (200 / 500 ms, web.dev). */
function metricBand(key: string, value: number) {
  if (key === 'inp') return value <= 200 ? 'good' : value <= 500 ? 'warn' : 'poor';
  return vitalBand(key as Parameters<typeof vitalBand>[0], value);
}

function StepCard({ step, index }: { step: FlowStepResult; index: number }) {
  const Icon = MODE_ICON[step.mode];
  const metrics = FLOW_MODE_METRICS[step.mode].filter(key => step.metrics[key] !== undefined);
  const scores = Object.entries(step.scores) as Array<[string, number]>;

  return (
    // The mode is on the DOM because it is what every assertion about this card is about —
    // which numbers may appear on it. Reading that back out of the rendered text means
    // matching prose, which is how a probe ends up passing on the wrong card.
    <Panel data-flow-mode={step.mode}>
      <PanelHeader
        icon={<Icon />}
        title={step.name}
        meta={`${index + 1} · ${MODE_LABEL[step.mode]}`}
      />
      <PanelBody>
        <p className="text-[12px] text-ld-text-3 mb-[12px]">{MODE_NOTE[step.mode]}</p>

        {scores.length > 0 && (
          <div className="flex flex-wrap gap-[8px] mb-[12px]">
            {scores.map(([key, value]) => {
              const band = scoreBand(value);
              return (
                <span key={key} className={`px-[10px] py-[6px] rounded-[10px] border text-[12px] font-semibold ${BAND_TILE[band]}`}>
                  <span className="text-ld-text-3 font-normal">{CATEGORY_LABEL[key] ?? key} </span>
                  <span className={BAND_TEXT[band]}>{value}</span>
                </span>
              );
            })}
          </div>
        )}

        {metrics.length > 0 && (
          <div className="flex flex-wrap gap-[14px] mb-[12px]">
            {metrics.map((key) => {
              const value = step.metrics[key]!;
              const band = metricBand(key, value);
              return (
                <span key={key} className="flex flex-col">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-ld-text-3">{METRIC_LABEL[key] ?? key}</span>
                  <span className={`font-mono text-[17px] font-bold tabular-nums ${BAND_TEXT[band]}`}>
                    {formatMetric(key, value)}
                  </span>
                </span>
              );
            })}
          </div>
        )}

        {step.audits.length > 0 ? (
          <ul className="flex flex-col gap-[6px]">
            {step.audits.map(audit => (
              <li key={audit.id} className="flex items-start gap-[8px] text-[12.5px]">
                <span className="mt-[6px] w-[5px] h-[5px] rounded-full bg-ld-amber shrink-0" />
                <span className="text-ld-text-2">
                  {audit.title}
                  {audit.displayValue && <span className="font-mono text-[11px] text-ld-text-3"> — {audit.displayValue}</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-ld-text-3">Nothing failing in this step.</p>
        )}
      </PanelBody>
    </Panel>
  );
}

export function FlowRunReport({ run }: { run: FlowRunResult }) {
  const interaction = run.steps.find(s => s.mode === 'timespan' && s.metrics.inp !== undefined);

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-baseline gap-[10px] flex-wrap">
        <span className="font-mono text-[11.5px] text-ld-text-3">
          {new Date(run.timestamp).toLocaleString()} · {run.formFactor} · {(run.durationMs / 1000).toFixed(0)}s
        </span>
        {interaction && (
          // The headline the feature exists for: a number no cold audit of this page can
          // produce, named with the interaction that caused it.
          <span className="text-[12.5px] text-ld-text-2">
            slowest measured interaction: <b className="text-ld-text">{interaction.name}</b>{' '}
            <span className="font-mono">{fmtMs(interaction.metrics.inp!)}</span>
          </span>
        )}
      </div>

      {run.steps.map((step, i) => <StepCard key={`${step.name}-${i}`} step={step} index={i} />)}
    </div>
  );
}
