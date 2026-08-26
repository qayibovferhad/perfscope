import { useState } from 'react';
import { Check, Clock, Footprints, History, Pencil, Play, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { fmtMs, type FlowDefinition, type FlowRunResult } from '@perfscope/shared';
import { Page, PageHeader } from '@/shared/ui/page';
import { Panel, PanelHeader, PanelBody } from '@/shared/ui/panel';
import { Button } from '@/shared/ui/button';
import { StatePanel, QueryErrorPanel } from '@/shared/ui/state-panel';
import { Skeleton } from '@/shared/ui/skeleton';
import { Sparkline } from '@/shared/ui/chart/Sparkline';
import { ConfirmModal } from '@/shared/ui/modal';
import { timeAgo } from '@/shared/lib/time';
import { getHostname } from '@/entities/website';
import {
  FlowEditorModal, FlowRunReport, useFlows, useFlowRun, useFlowRuns, describeSteps,
} from '@/features/flows';

/**
 * Flows — the pages measured *after* they load.
 *
 * Deliberately its own route rather than a tab on the analyzer. An audit answers "how fast
 * does this page arrive"; a flow answers "how does it behave once it is here", takes a
 * definition somebody wrote, and has its own history. Putting the second behind a tab of
 * the first would make it look like a mode of the analyzer, which it is not.
 */

/**
 * The slowest measured interaction of each run, oldest first.
 *
 * The worst step rather than the average, for the same reason the target check uses it: one
 * slow click is the finding, and averaging it with four fast ones is how it disappears.
 * Runs with no timespan step (a flow that only navigates) contribute nothing rather than a
 * zero, which would read as an instant interaction.
 */
function inpTrend(runs: FlowRunResult[]): number[] {
  return [...runs]
    .reverse()
    .map(run => run.steps
      .filter(step => step.mode === 'timespan' && typeof step.metrics.inp === 'number')
      .reduce((worst, step) => Math.max(worst, step.metrics.inp!), 0))
    .filter(value => value > 0);
}

/** How many interaction targets a flow actually sets — a card cannot say "on target" for a
 *  flow that promised nothing. */
const targetCount = (flow: FlowDefinition) =>
  [flow.targets?.inp, flow.targets?.tbt, flow.targets?.cls].filter(v => typeof v === 'number' && v > 0).length;

export function FlowsPage() {
  const { flows, isPending, isError, create, update, remove } = useFlows();
  const run = useFlowRun();

  const [editing, setEditing] = useState<FlowDefinition | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleting, setDeleting] = useState<FlowDefinition | null>(null);
  const [historyOf, setHistoryOf] = useState<string | null>(null);

  const { data: runs = [] } = useFlowRuns(historyOf);

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (flow: FlowDefinition) => { setEditing(flow); setEditorOpen(true); };

  return (
    <Page>
      <PageHeader
        eyebrow="Measurement"
        title="User flows"
        description="Load a page, then click through it — INP, layout shift and accessibility on the states an audit never reaches."
        actions={
          <Button onClick={openNew}>
            <Plus className="w-[17px] h-[17px]" /> New flow
          </Button>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-[18px] max-lg:grid-cols-1">
        {/* ─── The flows ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-[12px]">
          {isPending && [0, 1].map(i => <Skeleton key={i} className="h-[104px] rounded-[16px]" />)}

          {isError && <QueryErrorPanel what="your flows" />}

          {!isPending && !isError && flows.length === 0 && (
            <StatePanel
              icon={<Footprints />}
              title="No flows yet"
              description="A flow is a page plus the things you do to it. The first one usually takes two steps: open the thing people complain about, and see what it costs."
              action={<Button onClick={openNew}><Plus className="w-[16px] h-[16px]" /> New flow</Button>}
            />
          )}

          {flows.map(flow => (
            <Panel key={flow.id}>
              <PanelHeader
                icon={<Footprints />}
                title={flow.name}
                meta={flow.formFactor}
              />
              <PanelBody>
                <p className="font-mono text-[11.5px] text-ld-text-3 truncate" title={flow.url}>
                  {getHostname(flow.url)}{new URL(flow.url).pathname}
                </p>
                <p className="text-[12.5px] text-ld-text-2 mt-[6px]">{describeSteps(flow.steps)}</p>

                <div className="flex items-center gap-[8px] flex-wrap mt-[8px]">
                  {/* The verdict first: a card whose flow is over its interaction target is
                      the one worth opening, and "3 steps with findings" does not say that. */}
                  {flow.lastRun && flow.lastRun.missedTargets > 0 && (
                    <span className="inline-flex items-center gap-[5px] px-[8px] py-[3px] rounded-full text-[11px] font-semibold
                                     border border-ld-rose-line bg-ld-rose-wash text-ld-rose">
                      <TriangleAlert className="w-[11px] h-[11px]" />
                      {flow.lastRun.missedTargets} target{flow.lastRun.missedTargets === 1 ? '' : 's'} missed
                    </span>
                  )}
                  {targetCount(flow) > 0 && flow.lastRun?.missedTargets === 0 && (
                    <span className="inline-flex items-center gap-[5px] px-[8px] py-[3px] rounded-full text-[11px] font-semibold
                                     border border-ld-accent-line bg-ld-accent-wash text-ld-accent">
                      <Check className="w-[11px] h-[11px]" /> on target
                    </span>
                  )}
                  {flow.schedule?.enabled && (
                    <span className="inline-flex items-center gap-[5px] font-mono text-[11px] text-ld-text-3">
                      <Clock className="w-[11px] h-[11px]" /> daily {flow.schedule.time}
                    </span>
                  )}
                  <span className="text-[11.5px] text-ld-text-3">
                    {flow.lastRun
                      ? <>ran {timeAgo(flow.lastRun.at)}{flow.lastRun.failedSteps > 0
                          ? ` · ${flow.lastRun.failedSteps} step${flow.lastRun.failedSteps === 1 ? '' : 's'} with findings`
                          : ''}</>
                      : 'never run'}
                  </span>
                </div>

                <div className="flex items-center gap-[8px] mt-[12px] flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => { setHistoryOf(flow.id); run.run({ flowId: flow.id }); }}
                    disabled={run.status === 'running'}
                  >
                    <Play className="w-[14px] h-[14px]" /> Run
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(flow)}>
                    <Pencil className="w-[14px] h-[14px]" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setHistoryOf(flow.id)}>
                    <History className="w-[14px] h-[14px]" /> History
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Delete flow" onClick={() => setDeleting(flow)}>
                    <Trash2 className="w-[14px] h-[14px]" />
                  </Button>
                </div>
              </PanelBody>
            </Panel>
          ))}
        </div>

        {/* ─── What the last run said ────────────────────────────────────── */}
        <div className="flex flex-col gap-[12px]">
          {run.status === 'running' && (
            <Panel>
              <PanelHeader icon={<Play />} title="Running" meta={`${run.progress?.percent ?? 0}%`} />
              <PanelBody>
                <p className="text-[13px] text-ld-text-2">{run.progress?.message ?? 'Starting…'}</p>
                <span className="block h-[4px] rounded-full bg-ld-border mt-[10px] overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-ld-accent transition-[width] duration-500 ease-out"
                    style={{ width: `${run.progress?.percent ?? 3}%` }}
                  />
                </span>
                <p className="text-[11.5px] text-ld-text-3 mt-[8px]">
                  Each step is measured on its own, so this takes about as long as the flow does.
                </p>
              </PanelBody>
            </Panel>
          )}

          {run.status === 'error' && (
            <StatePanel
              variant="error"
              title="The flow stopped"
              description={run.error ?? 'It could not run.'}
              action={
                run.failedStep !== null && historyOf
                  ? <Button size="sm" onClick={() => {
                      const flow = flows.find(f => f.id === historyOf);
                      if (flow) openEdit(flow);
                    }}>Fix step {run.failedStep + 1}</Button>
                  : undefined
              }
            />
          )}

          {run.status === 'done' && run.result && <FlowRunReport run={run.result} />}

          {run.status === 'idle' && historyOf && runs.length > 0 && (
            <Panel>
              <PanelHeader icon={<History />} title="Earlier runs" meta={`${runs.length}`} />
              <PanelBody>
                {/* The trend, oldest to newest: a single run says what the interaction costs
                    today, and the only way to see that a release made it worse is the line. */}
                {inpTrend(runs).length > 1 && (
                  <div className="flex items-center gap-[10px] mb-[10px] pb-[10px] border-b border-ld-border">
                    <Sparkline values={inpTrend(runs)} id={`inp-${historyOf}`} width={120} height={30} />
                    <span className="text-[11.5px] text-ld-text-3">
                      slowest interaction per run · newest {fmtMs(inpTrend(runs).at(-1)!)}
                    </span>
                  </div>
                )}
                <ul className="flex flex-col gap-[6px]">
                  {runs.map(entry => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => run.show(entry)}
                        className="w-full text-left px-[10px] py-[8px] rounded-[10px] bg-transparent border-0 cursor-pointer
                                   hover:bg-ld-surface-2 transition-colors flex items-center justify-between gap-[10px]"
                      >
                        <span className="text-[12.5px] text-ld-text-2">{timeAgo(entry.timestamp)}</span>
                        <span className="font-mono text-[11.5px] text-ld-text-3">
                          {entry.steps.length} steps · {(entry.durationMs / 1000).toFixed(0)}s
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </PanelBody>
            </Panel>
          )}

          {run.status === 'idle' && !historyOf && flows.length > 0 && (
            <StatePanel
              compact
              icon={<Play />}
              title="Run a flow to see its report"
              description="Every step gets its own card — the load, each interaction, and the state it left behind."
            />
          )}
        </div>
      </div>

      <FlowEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        flow={editing}
        failedStep={editing && editing.id === historyOf ? run.failedStep : null}
        onSave={(input) => (editing
          ? update.mutateAsync({ id: editing.id, ...input })
          : create.mutateAsync(input))}
      />

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this flow?"
        subtitle={`"${deleting?.name}" and every report it produced will be removed.`}
        confirmLabel="Delete flow"
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
          if (deleting?.id === historyOf) { setHistoryOf(null); run.reset(); }
          setDeleting(null);
        }}
      />
    </Page>
  );
}
