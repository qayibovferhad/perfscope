import { Clock, LayoutList, Shuffle, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { expandSchedule, type AutomationScheduleMode, type AutomationSlot } from '@perfscope/shared';
import { Segmented, type SegmentOption } from '@/shared/ui/segmented';
import { TimePicker } from '@/shared/ui/time-picker';
import { Button } from '@/shared/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/ui/select';

const MODES: SegmentOption<AutomationScheduleMode>[] = [
  { value: 'single', label: 'One time',     icon: Clock,      title: 'Audit every route in one block' },
  { value: 'slots',  label: 'Split by time', icon: LayoutList, title: 'Pick which routes run at which time of day' },
  { value: 'spread', label: 'Spread',       icon: Shuffle,    title: 'Fan every route out evenly across a window' },
];

const WINDOWS = [
  { value: '30',   label: '30 minutes' },
  { value: '60',   label: '1 hour' },
  { value: '180',  label: '3 hours' },
  { value: '360',  label: '6 hours' },
  { value: '720',  label: '12 hours' },
  { value: '1440', label: 'the whole day' },
];

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[9px] font-bold uppercase tracking-widest mb-2 text-ld-text-3">{children}</p>
);

interface Props {
  routes:          string[];
  mode:            AutomationScheduleMode;
  onMode:          (mode: AutomationScheduleMode) => void;
  scheduleTime:    string;
  onScheduleTime:  (time: string) => void;
  slots:           AutomationSlot[];
  onSlots:         (slots: AutomationSlot[]) => void;
  spreadMinutes:   number;
  onSpreadMinutes: (minutes: number) => void;
}

/**
 * Chooses when each route is audited.
 *
 * The preview at the bottom is the point of the whole component: it is rendered by
 * `expandSchedule`, the same function the cron calls, so what the user reads here is
 * literally what will run. A hand-written summary would be a second implementation of the
 * scheduling rule and would eventually disagree with the scheduler.
 */
export function ScheduleEditor({
  routes, mode, onMode, scheduleTime, onScheduleTime,
  slots, onSlots, spreadMinutes, onSpreadMinutes,
}: Props) {
  const preview = expandSchedule({
    enabled: true, routes, scheduleTime, scheduleMode: mode, slots, spreadMinutes, lastRunAt: null,
  });

  const scheduled = new Set(preview.flatMap(s => s.routes));
  const orphans   = routes.filter(r => !scheduled.has(r));

  function updateSlot(index: number, patch: Partial<AutomationSlot>) {
    onSlots(slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }

  function toggleRoute(index: number, route: string) {
    const current = slots[index]?.routes ?? [];
    updateSlot(index, {
      routes: current.includes(route) ? current.filter(r => r !== route) : [...current, route],
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Schedule</Label>
        <Segmented
          options={MODES}
          value={mode}
          onChange={onMode}
          ariaLabel="Schedule mode"
          disabled={routes.length === 0}
        />
      </div>

      {mode === 'single' && (
        <div>
          <Label>Run at</Label>
          <TimePicker value={scheduleTime} onChange={onScheduleTime} />
        </div>
      )}

      {mode === 'spread' && (
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label>Starting at</Label>
            <TimePicker value={scheduleTime} onChange={onScheduleTime} />
          </div>
          <div>
            <Label>Spread across</Label>
            <Select
              value={String(spreadMinutes)}
              onValueChange={v => onSpreadMinutes(Number(v))}
            >
              <SelectTrigger className="h-9 w-[150px] text-xs bg-ld-bg-2 border-ld-border-strong rounded-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-ld-bg-2 border-ld-border">
                {WINDOWS.map(w => (
                  <SelectItem
                    key={w.value}
                    value={w.value}
                    className="text-xs cursor-pointer text-ld-text focus:bg-ld-accent-soft focus:text-ld-accent"
                  >
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {mode === 'slots' && (
        <div>
          <Label>Time slots</Label>
          <div className="flex flex-col gap-2">
            {slots.map((slot, i) => (
              <div key={i} className="rounded-[12px] border border-ld-border bg-ld-surface-2 p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <TimePicker value={slot.time} onChange={time => updateSlot(i, { time })} />
                  <button
                    type="button"
                    onClick={() => onSlots(slots.filter((_, j) => j !== i))}
                    aria-label={`Remove the ${slot.time} slot`}
                    className="w-7 h-7 rounded-[8px] grid place-items-center text-ld-rose hover:bg-ld-surface"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {routes.length === 0 ? (
                  <p className="text-[11px] italic text-ld-text-3">Add routes above first.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {routes.map(route => {
                      const on = slot.routes.includes(route);
                      return (
                        <button
                          key={route}
                          type="button"
                          onClick={() => toggleRoute(i, route)}
                          aria-pressed={on}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border transition-colors ${
                            on
                              ? 'bg-ld-accent-soft border-ld-accent-line text-ld-accent'
                              : 'bg-ld-surface border-ld-border text-ld-text-3 hover:text-ld-text-2'
                          }`}
                        >
                          {route}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs mt-2"
            disabled={routes.length === 0}
            onClick={() => onSlots([...slots, { time: '02:00', routes: [] }])}
          >
            <Plus className="w-3.5 h-3.5" /> Add slot
          </Button>
        </div>
      )}

      {/* ── What will actually run ──────────────────────────────────────── */}
      <div className="rounded-[12px] border border-ld-border bg-ld-bg-2 px-3 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-widest mb-2 text-ld-text-3">
          Daily timetable
        </p>

        {preview.length === 0 ? (
          <p className="text-[11px] text-ld-text-3 italic">
            Nothing is scheduled — this site will never be audited automatically.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {preview.map(slot => (
              <li key={slot.time} className="flex items-start gap-2 text-[11px]">
                <span className="font-mono font-bold text-ld-accent-2 shrink-0">{slot.time}</span>
                <span className="font-mono text-ld-text-2 break-all">{slot.routes.join('  ·  ')}</span>
              </li>
            ))}
          </ul>
        )}

        {orphans.length > 0 && (
          <p className="flex items-start gap-1.5 text-[10.5px] text-ld-amber mt-2">
            <AlertTriangle className="w-3 h-3 mt-[1px] shrink-0" />
            <span>
              Never audited: <span className="font-mono">{orphans.join(', ')}</span>
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
