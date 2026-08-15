import { useState } from 'react';
import { Moon, Plus, X, Route, Loader2 } from 'lucide-react';
import { expandSchedule, SCORE_BANDS, VITAL_THRESHOLDS, type AutomationScheduleMode, type AutomationSlot } from '@perfscope/shared';
import { Modal }              from '@/shared/ui/modal/Modal';
import { Input }              from '@/shared/ui/input';
import { Button }             from '@/shared/ui/button';
import { Toggle }             from '@/shared/ui/toggle';
import { ScheduleEditor }     from './ScheduleEditor';
import { useAutomation }      from '@/features/automation';
import { getHostname, useWebsites } from '@/entities/website';
import type { Website }       from '@/entities/website';

interface Props {
  site:    Website;
  open:    boolean;
  onClose: () => void;
}

export function SetupModal({ site, open, onClose }: Props) {
  const automation = useAutomation(site._id);
  const { setBudgets } = useWebsites();

  const [routes,        setRoutes]        = useState<string[]>(site.automation?.routes ?? []);
  const [input,         setInput]         = useState('');
  const [inputError,    setInputError]    = useState('');
  const [enabled,       setEnabled]       = useState(site.automation?.enabled ?? false);
  const [scheduleTime,  setScheduleTime]  = useState(site.automation?.scheduleTime ?? '00:00');
  const [mode,          setMode]          = useState<AutomationScheduleMode>(site.automation?.scheduleMode ?? 'single');
  const [slots,         setSlots]         = useState<AutomationSlot[]>(site.automation?.slots ?? []);
  const [spreadMinutes, setSpreadMinutes] = useState(site.automation?.spreadMinutes ?? 60);

  // These initialisers are the hydration: the modal is mounted fresh per opening and keyed
  // by site at the call site. They used to be hardcoded empty, so reopening showed a blank
  // form and saving from it wiped the site's real schedule — a configured automation would
  // just stop, with the UI still claiming it was set up.

  // Budgets — hydrated from the site so reopening the modal shows current thresholds.
  const [budgetPerf, setBudgetPerf] = useState(site.budgets?.performance?.toString() ?? '');
  const [budgetLcp,  setBudgetLcp]  = useState(site.budgets?.lcp?.toString() ?? '');
  const [budgetTbt,  setBudgetTbt]  = useState(site.budgets?.tbt?.toString() ?? '');
  const [budgetCls,  setBudgetCls]  = useState(site.budgets?.cls?.toString() ?? '');
  const [budgetInp,  setBudgetInp]  = useState(site.budgets?.inp?.toString() ?? '');
  const [webhookUrl, setWebhookUrl] = useState(site.budgets?.webhookUrl ?? '');
  const [alertEmail, setAlertEmail] = useState(site.budgets?.alertEmail ?? '');

  const parseNum = (v: string): number | null => {
    const n = Number(v.trim());
    return v.trim() !== '' && Number.isFinite(n) ? n : null;
  };

  function handleAdd() {
    const raw = input.trim();
    if (!raw) return;
    const route = raw.startsWith('/') ? raw : `/${raw}`;
    if (routes.includes(route)) { setInputError('Already added'); return; }
    setInputError('');
    setInput('');
    setRoutes(prev => [...prev, route]);
  }

  // Slots referencing a route the user just deleted would be rejected by the API, and
  // empty slots are meaningless — drop both rather than failing the save.
  const cleanedSlots = slots
    .map(slot => ({ ...slot, routes: slot.routes.filter(r => routes.includes(r)) }))
    .filter(slot => slot.routes.length > 0);

  const timetable = expandSchedule({
    routes, scheduleTime, scheduleMode: mode,
    slots: cleanedSlots, spreadMinutes,
  });

  async function handleSave() {
    await Promise.all([
      automation.save({
        routes, enabled, scheduleTime,
        scheduleMode: mode, slots: cleanedSlots, spreadMinutes,
      }),
      setBudgets.mutateAsync({
        id:          site._id,
        performance: parseNum(budgetPerf),
        lcp:         parseNum(budgetLcp),
        tbt:         parseNum(budgetTbt),
        cls:         parseNum(budgetCls),
        inp:         parseNum(budgetInp),
        webhookUrl:  webhookUrl.trim() || null,
        alertEmail:  alertEmail.trim() || null,
      }),
    ]);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="wide">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg grid place-items-center shrink-0 bg-ld-accent-soft">
          <Moon className="w-4 h-4 text-ld-accent" />
        </div>
        <div>
          <p className="text-[15px] font-bold text-ld-text">Set up Automation</p>
          <p className="text-[10px] font-mono text-ld-text-3 mt-0.5">{getHostname(site.url)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Routes */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2 text-ld-text-3">
            Routes to audit
          </p>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={e => { setInput(e.target.value); setInputError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
                placeholder="/dashboard  or  /"
                autoFocus
                error={!!inputError}
                className="h-8 text-xs font-mono"
              />
              {inputError && (
                <p className="absolute -bottom-4 left-0 text-[10px] text-ld-rose">{inputError}</p>
              )}
            </div>
            <Button size="sm" onClick={handleAdd} disabled={!input.trim()} className="h-8 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>

          {routes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {routes.map(r => (
                <span key={r}
                  className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-ld-accent-soft border border-ld-accent-line text-ld-accent">
                  <Route className="w-2.5 h-2.5 shrink-0" />
                  {r}
                  <button
                    onClick={() => setRoutes(prev => prev.filter(x => x !== r))}
                    className="ml-0.5 w-3.5 h-3.5 rounded grid place-items-center text-ld-rose hover:bg-ld-rose/20"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] italic mt-3 text-ld-text-3">
              Add at least one route to enable automation.
            </p>
          )}
        </div>

        {/* Schedule */}
        <ScheduleEditor
          routes={routes}
          mode={mode}
          onMode={setMode}
          scheduleTime={scheduleTime}
          onScheduleTime={setScheduleTime}
          slots={slots}
          onSlots={setSlots}
          spreadMinutes={spreadMinutes}
          onSpreadMinutes={setSpreadMinutes}
        />

        {/* Performance budgets */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2 text-ld-text-3">
            Performance budgets <span className="normal-case font-medium tracking-normal">— checked against audits, and against real-user p75</span>
          </p>
          <div className="grid grid-cols-5 gap-2 max-[560px]:grid-cols-3">
            {([
              // Placeholders are web.dev's "good" thresholds, read from the shared table.
              ['Min score', budgetPerf, setBudgetPerf, String(SCORE_BANDS.good)],
              ['Max LCP ms', budgetLcp, setBudgetLcp, String(VITAL_THRESHOLDS.lcp.good)],
              ['Max TBT ms', budgetTbt, setBudgetTbt, String(VITAL_THRESHOLDS.tbt.good)],
              ['Max CLS', budgetCls, setBudgetCls, String(VITAL_THRESHOLDS.cls.good)],
              ['Max INP ms', budgetInp, setBudgetInp, String(VITAL_THRESHOLDS.inp.good)],
            ] as const).map(([label, value, setter, ph]) => (
              <div key={label}>
                <p className="text-[9px] text-ld-text-3 mb-1">{label}</p>
                <Input
                  value={value}
                  onChange={e => setter(e.target.value)}
                  placeholder={ph}
                  inputMode="decimal"
                  className="h-8 text-xs font-mono"
                />
              </div>
            ))}
          </div>
          <p className="text-[9.5px] text-ld-text-3 mt-3 leading-[1.5]">
            Alerts fire on a budget breach, and whenever a run degrades sharply against the
            previous audit of the same page — set a channel to get regression alerts even
            without thresholds. LCP, CLS and INP are also checked hourly against real-user
            p75; INP has no lab equivalent, so it is field-only.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[9px] text-ld-text-3 mb-1">Alert webhook (Slack/Discord/custom)</p>
              <Input
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/…"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div>
              <p className="text-[9px] text-ld-text-3 mb-1">Alert email</p>
              <Input
                value={alertEmail}
                onChange={e => setAlertEmail(e.target.value)}
                placeholder="you@company.com"
                type="email"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between py-3 px-3 rounded-xl bg-ld-surface-2 border border-ld-border">
          <div>
            <p className="text-xs font-semibold text-ld-text">Enable automation</p>
            <p className="text-[10px] text-ld-text-3">
              {timetable.length === 0
                ? 'Nothing scheduled yet'
                : timetable.length === 1
                  ? `Runs daily at ${timetable[0]!.time}`
                  : `Runs daily at ${timetable.map(s => s.time).join(', ')}`}
            </p>
          </div>
          <Toggle
            label="Run this site on a schedule"
            enabled={enabled}
            onChange={setEnabled}
            disabled={timetable.length === 0}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={onClose} className="text-xs">Cancel</Button>
        <Button
          onClick={handleSave}
          disabled={routes.length === 0 || automation.isSaving}
          className="text-xs"
        >
          {automation.isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : 'Save'}
        </Button>
      </div>
    </Modal>
  );
}
