import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Footprints, Plus, Trash2 } from 'lucide-react';
import {
  MAX_FLOW_STEPS, describeFlowStep,
  type FlowActionKind, type FlowDefinition, type FlowStep,
} from '@perfscope/shared';
import { Modal, ModalHeader } from '@/shared/ui/modal';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { Toggle } from '@/shared/ui/toggle';
import { TimePicker } from '@/shared/ui/time-picker';
import { Field } from '@/shared/ui/field';
import { Segmented } from '@/shared/ui/segmented';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/ui/select';
import type { FlowInput } from '../model/useFlows';

/**
 * Writing a flow.
 *
 * A list of rows, not a recorder. A recorder is the obvious next thing to want and a much
 * larger one to build — it needs a browser this page can watch. What this does instead is
 * make the *definition* readable: each row says what it does in plain words, and the ones
 * that are only plumbing can be marked as such so the report stays about the interactions.
 */

/** What each action needs from the person writing it. Kept beside the labels because the
 *  two answer the same question — "what do I type in this row". */
const ACTIONS: Array<{
  value: FlowActionKind;
  label: string;
  selector?: 'required';
  value_?: { label: string; placeholder: string };
}> = [
  { value: 'click',    label: 'Click',           selector: 'required' },
  { value: 'type',     label: 'Type',            selector: 'required', value_: { label: 'Text', placeholder: 'hello@example.com' } },
  { value: 'press',    label: 'Press a key',     value_: { label: 'Key', placeholder: 'Enter' } },
  { value: 'hover',    label: 'Hover',           selector: 'required' },
  { value: 'scroll',   label: 'Scroll',          value_: { label: 'Pixels', placeholder: 'to the bottom' } },
  { value: 'waitFor',  label: 'Wait for element', selector: 'required' },
  { value: 'wait',     label: 'Wait',            value_: { label: 'Milliseconds', placeholder: '1000' } },
  { value: 'navigate', label: 'Go to URL',       value_: { label: 'URL', placeholder: 'https://example.com/checkout' } },
];

const spec = (action: FlowActionKind) => ACTIONS.find(a => a.value === action)!;

const EMPTY_STEP: FlowStep = { action: 'click', selector: '', measure: true };

/** Named for what they measure rather than by their acronym alone — a flow's targets are
 *  read by whoever writes the flow, not only by whoever already knows the metrics. */
const TARGET_LABEL = { inp: 'INP target', tbt: 'TBT target', cls: 'CLS target' } as const;
const TARGET_PLACEHOLDER = { inp: '200 ms', tbt: '300 ms', cls: '0.10' } as const;

interface Props {
  open: boolean;
  onClose: () => void;
  /** The flow being edited, or null for a new one. */
  flow: FlowDefinition | null;
  onSave: (input: FlowInput) => Promise<unknown>;
  /** The step the last run failed on, highlighted so a fix starts in the right row. */
  failedStep?: number | null;
}

export function FlowEditorModal({ open, onClose, flow, onSave, failedStep = null }: Props) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [steps, setSteps] = useState<FlowStep[]>([{ ...EMPTY_STEP }]);
  const [snapshotAtEnd, setSnapshotAtEnd] = useState(true);
  const [formFactor, setFormFactor] = useState<'mobile' | 'desktop'>('desktop');
  const [scheduled, setScheduled] = useState(false);
  const [time, setTime] = useState('03:00');
  const [targets, setTargets] = useState<{ inp: string; tbt: string; cls: string }>({ inp: '', tbt: '', cls: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset from the flow every time the modal opens, not once on mount: the same modal
  // instance edits every row in the list, and keeping the previous one's steps would let
  // somebody save them onto a different flow.
  useEffect(() => {
    if (!open) return;
    setName(flow?.name ?? '');
    setUrl(flow?.url ?? '');
    setSteps(flow?.steps?.length ? flow.steps.map(s => ({ ...s })) : [{ ...EMPTY_STEP }]);
    setSnapshotAtEnd(flow?.snapshotAtEnd !== false);
    setFormFactor(flow?.formFactor === 'mobile' ? 'mobile' : 'desktop');
    setScheduled(flow?.schedule?.enabled === true);
    setTime(flow?.schedule?.time ?? '03:00');
    setTargets({
      inp: flow?.targets?.inp != null ? String(flow.targets.inp) : '',
      tbt: flow?.targets?.tbt != null ? String(flow.targets.tbt) : '',
      cls: flow?.targets?.cls != null ? String(flow.targets.cls) : '',
    });
    setError('');
  }, [open, flow]);

  const patch = (index: number, changes: Partial<FlowStep>) =>
    setSteps(prev => prev.map((step, i) => (i === index ? { ...step, ...changes } : step)));

  const move = (index: number, by: number) =>
    setSteps(prev => {
      const next = [...prev];
      const target = index + by;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  async function save() {
    setError('');
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        url: url.trim(),
        steps,
        snapshotAtEnd,
        formFactor,
        schedule: { enabled: scheduled, time },
        // An empty box is "no target", which the server stores as null — the same contract
        // the site budgets use, so clearing one is just clearing the field.
        targets: {
          inp: targets.inp.trim() ? Number(targets.inp) : null,
          tbt: targets.tbt.trim() ? Number(targets.tbt) : null,
          cls: targets.cls.trim() ? Number(targets.cls) : null,
        },
        ...(flow?.websiteId ? { websiteId: flow.websiteId } : {}),
      });
      onClose();
    } catch (err) {
      // The server validates step by step and says which one — far more useful than
      // anything this form could work out on its own, so it is shown verbatim.
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? 'Could not save the flow');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="wide">
      <ModalHeader
        icon={<Footprints className="w-[21px] h-[21px]" />}
        title={flow ? 'Edit flow' : 'New flow'}
        subtitle="Load a page, then do things to it — each step is measured on its own."
      />

      <div className="flex flex-col gap-[14px] mt-[18px]">
        <div className="grid grid-cols-2 gap-[12px] max-sm:grid-cols-1">
          <Field label="Name">
            {(id) => <Input id={id} value={name} onChange={e => setName(e.target.value)} placeholder="Checkout — open the coupon panel" />}
          </Field>
          <Field label="Starting URL">
            {(id) => <Input id={id} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/checkout" />}
          </Field>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-ld-text-2">Steps</span>
            <span className="font-mono text-[11px] text-ld-text-3">{steps.length} / {MAX_FLOW_STEPS}</span>
          </div>

          <div className="flex flex-col gap-[8px] max-h-[42vh] overflow-y-auto pr-1">
            {steps.map((step, index) => {
              const s = spec(step.action);
              const failed = failedStep === index;
              return (
                <div
                  key={index}
                  className={`rounded-[12px] border p-[10px] flex flex-col gap-[8px] ${
                    failed ? 'border-ld-rose-line bg-ld-rose-wash' : 'border-ld-border bg-ld-surface-2'
                  }`}
                >
                  <div className="flex items-center gap-[8px]">
                    <span className="font-mono text-[11px] text-ld-text-3 w-[18px] shrink-0">{index + 1}</span>

                    <Select
                      value={step.action}
                      onValueChange={(v) => patch(index, { action: v as FlowActionKind, selector: '', value: '' })}
                    >
                      <SelectTrigger className="w-[150px] h-[32px] rounded-[9px] border-ld-border bg-ld-surface text-[12.5px] shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-ld-surface border-ld-border">
                        {ACTIONS.map(a => (
                          <SelectItem key={a.value} value={a.value} className="text-[12.5px] cursor-pointer text-ld-text focus:bg-ld-accent-soft focus:text-ld-accent">
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <span className="flex-1 truncate font-mono text-[11px] text-ld-text-3">
                      {describeFlowStep(step)}
                    </span>

                    <Button variant="ghost" size="icon-xs" onClick={() => move(index, -1)} aria-label="Move step up" disabled={index === 0}>
                      <ArrowUp className="w-[13px] h-[13px]" />
                    </Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => move(index, 1)} aria-label="Move step down" disabled={index === steps.length - 1}>
                      <ArrowDown className="w-[13px] h-[13px]" />
                    </Button>
                    <Button
                      variant="ghost" size="icon-xs" aria-label="Remove step"
                      onClick={() => setSteps(prev => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))}
                      disabled={steps.length === 1}
                    >
                      <Trash2 className="w-[13px] h-[13px]" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-[8px] flex-wrap pl-[26px]">
                    {s.selector && (
                      <Input
                        value={step.selector ?? ''}
                        onChange={e => patch(index, { selector: e.target.value })}
                        placeholder="CSS selector — #checkout, .cta button"
                        wrapperClassName="flex-1 min-w-[200px]"
                        className="h-[32px] text-[12.5px] font-mono"
                      />
                    )}
                    {s.value_ && (
                      <Input
                        value={step.value ?? ''}
                        onChange={e => patch(index, { value: e.target.value })}
                        placeholder={s.value_.placeholder}
                        wrapperClassName={s.selector ? 'w-[170px]' : 'flex-1 min-w-[200px]'}
                        className="h-[32px] text-[12.5px] font-mono"
                      />
                    )}
                    <label className="flex items-center gap-[6px] text-[11.5px] text-ld-text-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={step.measure !== false}
                        onChange={e => patch(index, { measure: e.target.checked })}
                        className="accent-[var(--ld-accent)] w-[13px] h-[13px]"
                      />
                      Measure
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            variant="dashed" size="sm"
            onClick={() => setSteps(prev => (prev.length >= MAX_FLOW_STEPS ? prev : [...prev, { ...EMPTY_STEP }]))}
            disabled={steps.length >= MAX_FLOW_STEPS}
          >
            <Plus className="w-[14px] h-[14px]" /> Add step
          </Button>
          <p className="text-[11.5px] text-ld-text-3">
            Turn <b>Measure</b> off for the plumbing — a cookie banner, a field to fill — so the
            report only carries the interactions worth reading.
          </p>
        </div>

        <div className="flex items-center gap-[14px] flex-wrap">
          <Segmented
            size="sm"
            ariaLabel="Form factor"
            options={[{ value: 'desktop', label: 'Desktop' }, { value: 'mobile', label: 'Mobile' }]}
            value={formFactor}
            onChange={v => setFormFactor(v as 'mobile' | 'desktop')}
          />
          <Toggle
            label="Audit the final state"
            enabled={snapshotAtEnd}
            onChange={setSnapshotAtEnd}
          />
          <span className="text-[11.5px] text-ld-text-3">
            Accessibility and best practices on whatever the flow left on screen.
          </span>
        </div>

        {/* ── When it runs, and what it promises ───────────────────────────── */}
        <div className="flex flex-col gap-[12px] rounded-[12px] border border-ld-border bg-ld-surface-2 p-[12px]">
          <div className="flex items-center gap-[14px] flex-wrap">
            <Toggle label="Run this flow every day" enabled={scheduled} onChange={setScheduled} />
            <span className="text-[12.5px] text-ld-text-2">Run every day</span>
            {scheduled && <TimePicker value={time} onChange={setTime} />}
          </div>

          <div className="flex items-end gap-[10px] flex-wrap">
            {(['inp', 'tbt', 'cls'] as const).map((metric) => (
              <Field key={metric} label={TARGET_LABEL[metric]} className="w-[128px]">
                {(id) => (
                  <Input
                    id={id}
                    value={targets[metric]}
                    onChange={e => setTargets(t => ({ ...t, [metric]: e.target.value }))}
                    placeholder={TARGET_PLACEHOLDER[metric]}
                    inputMode="decimal"
                    className="h-[34px] text-[13px] font-mono"
                  />
                )}
              </Field>
            ))}
            <p className="flex-1 min-w-[200px] text-[11.5px] text-ld-text-3 pb-[6px]">
              Ceilings over the <b>measured interactions</b> — the page load has the site's own
              budget. A run over one raises an alert on the site this URL belongs to.
            </p>
          </div>
        </div>

        {error && (
          <p className="text-[12px] px-3 py-2 rounded-[10px] border border-ld-rose-line bg-ld-rose-wash text-ld-rose">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-[10px] pt-[4px]">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name.trim() || !url.trim()}>
            {saving ? 'Saving…' : flow ? 'Save changes' : 'Create flow'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
