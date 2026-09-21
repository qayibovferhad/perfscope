import { useState } from 'react';
import { Activity, Camera, MousePointerClick, TriangleAlert } from 'lucide-react';
import {
  FLOW_MODE_METRICS, fmtMs, fmtCls,
  type FlowStepMode, type FlowStepResult, type FlowRunResult,
} from '@perfscope/shared';
import { Panel, PanelHeader, PanelBody } from '@/shared/ui/panel';
import { InstrumentField } from '@/shared/ui/instrument';
import { scoreBand, vitalBand, BAND_TEXT, BAND_TILE, BAND_BORDER } from '@/entities/analysis';

/**
 * A flow report: the journey, then the step you asked about.
 *
 * It used to be one full panel per step, stacked — three or six identical cards, each
 * repeating the same headings, and the one question the feature exists to answer ("which
 * interaction was slow") was something you assembled by scrolling and comparing numbers
 * in your head. A flow is a *sequence*, so it is drawn as one: every step on a track, its
 * headline number under it, the worst interaction flagged, and one detail panel below for
 * whichever step is selected.
 *
 * Every step still asks only what its own mode can answer. Lighthouse hands back a full
 * report for each one, most of which is meaningless outside the mode that produced it — a
 * snapshot's `performance: 0` is not a score, it is the absence of one — so the server
 * already dropped what does not apply (`flow-transform.ts`) and this draws what survived.
 *
 * Built as tabs rather than as a filter: every step's panel stays in the DOM and the
 * inactive ones are `hidden`, which is what gives the track arrow-key navigation, keeps a
 * screen reader's relationship between a tab and its panel, and leaves the whole run
 * readable to anything that reads the document rather than looks at it.
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

/** What each mode is *for*, said once on the open panel. Without it a reader wonders why
 *  the interaction has no LCP and assumes something failed. */
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

/**
 * The one number a step is worth reading at a glance.
 *
 * Per mode, because the modes do not measure the same thing: a load is judged on LCP, an
 * interaction on INP, and a snapshot has no timing at all, so it reports the accessibility
 * it was taken for. Never a mode's *absent* number — that is how a snapshot ends up
 * printing a performance score of zero.
 */
function headline(step: FlowStepResult): { value: string; label: string; band: 'good' | 'warn' | 'poor' } | null {
  if (step.mode === 'snapshot') {
    const a11y = step.scores.accessibility;
    return a11y === undefined ? null : { value: String(a11y), label: 'A11y', band: scoreBand(a11y) };
  }

  const keys = step.mode === 'timespan' ? ['inp', 'tbt'] : ['lcp', 'fcp'];
  for (const key of keys) {
    const value = step.metrics[key as keyof FlowStepResult['metrics']];
    if (value !== undefined) {
      return { value: formatMetric(key, value), label: METRIC_LABEL[key]!, band: metricBand(key, value) };
    }
  }

  const perf = step.scores.performance;
  return perf === undefined ? null : { value: String(perf), label: 'Perf', band: scoreBand(perf) };
}

// ─── The track ───────────────────────────────────────────────────────────────

function TrackNode({
  step, index, selected, worst, onSelect, panelId, tabId,
}: {
  step: FlowStepResult;
  index: number;
  selected: boolean;
  worst: boolean;
  onSelect: () => void;
  panelId: string;
  tabId: string;
}) {
  const Icon = MODE_ICON[step.mode];
  const head = headline(step);

  return (
    <li className="flex items-center min-w-0">
      {/* The connector belongs to the node after it, so a wrapped track never ends a row
          with a rule pointing at nothing. */}
      {index > 0 && <span aria-hidden className="w-[18px] h-px bg-ld-border shrink-0" />}

      <button
        type="button"
        role="tab"
        id={tabId}
        aria-selected={selected}
        aria-controls={panelId}
        tabIndex={selected ? 0 : -1}
        onClick={onSelect}
        className={`w-[164px] max-sm:w-[136px] shrink-0 text-left px-[13px] py-[11px] rounded-[14px] border transition-colors duration-150
                    ${selected
                      ? 'border-ld-accent-line bg-ld-accent-wash'
                      : 'border-ld-border bg-ld-surface hover:border-ld-border-strong hover:bg-ld-surface-hover'}`}
      >
        <span className="flex items-center gap-[8px] min-w-0">
          <span className={`w-[26px] h-[26px] rounded-[9px] grid place-items-center border shrink-0 [&_svg]:w-[13px] [&_svg]:h-[13px]
                            ${head ? BAND_TILE[head.band] : 'border-ld-border bg-ld-surface-2 text-ld-text-3'}`}>
            <Icon />
          </span>
          <span className="font-mono text-[10.5px] text-ld-text-3 tabular-nums">
            {String(index + 1).padStart(2, '0')}
          </span>
          {worst && (
            <span
              className="ml-auto inline-flex items-center gap-[3px] text-[10px] font-semibold px-[6px] py-[2px] rounded-full border border-ld-rose-line bg-ld-rose-wash text-ld-rose shrink-0"
              title="The slowest measured interaction in this run"
            >
              <TriangleAlert className="w-[9px] h-[9px]" /> worst
            </span>
          )}
        </span>

        <span className="block truncate text-[12.5px] font-semibold text-ld-text mt-[9px]">{step.name}</span>

        {head ? (
          <span className="flex items-baseline gap-[5px] mt-[5px]">
            <b className={`font-mono text-[17px] font-semibold tabular-nums ${BAND_TEXT[head.band]}`}>{head.value}</b>
            <span className="font-mono text-[10px] uppercase tracking-[.12em] text-ld-text-3">{head.label}</span>
          </span>
        ) : (
          <span className="block font-mono text-[10.5px] text-ld-text-3 mt-[7px]">no reading</span>
        )}

        <span className="block font-mono text-[10px] uppercase tracking-[.14em] text-ld-text-3 mt-[6px]">
          {MODE_LABEL[step.mode]}
        </span>
      </button>
    </li>
  );
}

// ─── The open step ───────────────────────────────────────────────────────────

function StepDetail({
  step, index, selected, panelId, tabId,
}: {
  step: FlowStepResult;
  index: number;
  selected: boolean;
  panelId: string;
  tabId: string;
}) {
  const Icon = MODE_ICON[step.mode];
  const metrics = FLOW_MODE_METRICS[step.mode].filter(key => step.metrics[key] !== undefined);
  const scores = Object.entries(step.scores) as Array<[string, number]>;
  const head = headline(step);

  return (
    // `data-flow-mode` is on the DOM because it is what every assertion about this panel is
    // about — which numbers may appear on it. Reading that back out of rendered text means
    // matching prose, which is how a probe ends up passing on the wrong step.
    <Panel
      data-flow-mode={step.mode}
      id={panelId}
      role="tabpanel"
      aria-labelledby={tabId}
      hidden={!selected}
      className={head ? BAND_BORDER[head.band] : undefined}
    >
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

// ─── The run ─────────────────────────────────────────────────────────────────

export function FlowRunReport({ run }: { run: FlowRunResult }) {
  /** The slowest measured interaction — the number no cold audit of this page can produce,
   *  and the reason to open one step rather than another. */
  const worstIndex = run.steps.reduce((worst, step, i) => {
    if (step.mode !== 'timespan' || step.metrics.inp === undefined) return worst;
    const best = worst === -1 ? -1 : run.steps[worst]!.metrics.inp!;
    return step.metrics.inp > best ? i : worst;
  }, -1);

  // Opens on the step worth reading: the slowest interaction, or the load when a flow has
  // no measured interaction at all. Keyed to the run so a second run reopens its own.
  const [selected, setSelected] = useState(() => (worstIndex === -1 ? 0 : worstIndex));
  const [shownRun, setShownRun] = useState(run.id);
  if (shownRun !== run.id) {
    setShownRun(run.id);
    setSelected(worstIndex === -1 ? 0 : worstIndex);
  }

  const worst = worstIndex === -1 ? null : run.steps[worstIndex]!;
  const idFor = (kind: 'tab' | 'panel', i: number) => `flow-${run.id}-${kind}-${i}`;

  /** Left/right walk the track, as a tablist is expected to. */
  function onKeyDown(e: React.KeyboardEvent) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (selected + delta + run.steps.length) % run.steps.length;
    setSelected(next);
    document.getElementById(idFor('tab', next))?.focus();
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-baseline gap-[10px] flex-wrap">
        <span className="font-mono text-[11.5px] text-ld-text-3">
          {new Date(run.timestamp).toLocaleString()} · {run.formFactor} · {(run.durationMs / 1000).toFixed(0)}s
        </span>
        {worst && (
          <span className="text-[12.5px] text-ld-text-2">
            slowest measured interaction: <b className="text-ld-text">{worst.name}</b>{' '}
            <span className="font-mono">{fmtMs(worst.metrics.inp!)}</span>
          </span>
        )}
      </div>

      {/* The journey. Scrolls sideways rather than wrapping: a flow is an order, and a
          track that reflows into two rows stops reading as one. */}
      <InstrumentField marks={false}>
        <div className="px-[16px] py-[14px] overflow-x-auto">
          <ul
            role="tablist"
            aria-label="Steps in this run"
            onKeyDown={onKeyDown}
            className="flex items-stretch min-w-max"
          >
            {run.steps.map((step, i) => (
              <TrackNode
                key={`${step.name}-${i}`}
                step={step}
                index={i}
                selected={i === selected}
                worst={i === worstIndex}
                onSelect={() => setSelected(i)}
                tabId={idFor('tab', i)}
                panelId={idFor('panel', i)}
              />
            ))}
          </ul>
        </div>
      </InstrumentField>

      {run.steps.map((step, i) => (
        <StepDetail
          key={`${step.name}-${i}`}
          step={step}
          index={i}
          selected={i === selected}
          tabId={idFor('tab', i)}
          panelId={idFor('panel', i)}
        />
      ))}
    </div>
  );
}
