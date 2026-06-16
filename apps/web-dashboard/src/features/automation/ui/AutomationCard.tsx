import { useState } from 'react';
import { Moon, Plus, X, Link as LinkIcon } from 'lucide-react';
import { Input }       from '@/shared/ui/input';
import { Button }      from '@/shared/ui/button';
import { Toggle }      from '@/shared/ui/toggle';
import { TimePicker }  from '@/shared/ui/time-picker';
import { useWebsites } from '@/features/dashboard/hooks/useWebsites';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtLastRun(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function nextRunLabel(scheduleTime: string): string {
  const [hh, mm] = scheduleTime.split(':');
  const paddedHH = String(hh).padStart(2, '0');
  const paddedMM = String(mm).padStart(2, '0');
  const now = new Date();
  const scheduledMinutes = parseInt(hh!) * 60 + parseInt(mm!);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const day = scheduledMinutes > nowMinutes ? 'Today' : 'Tomorrow';
  return `${day} · ${paddedHH}:${paddedMM}`;
}

// ─── Field box ────────────────────────────────────────────────────────────────

function AField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-[16px] py-[14px] rounded-[13px] border border-ld-border bg-ld-surface-2">
      <p className="font-mono text-[10px] tracking-[.12em] uppercase text-ld-text-3 mb-[10px]">{label}</p>
      {children}
    </div>
  );
}

// ─── Automation card ──────────────────────────────────────────────────────────

export function AutomationCard({
  websiteId, enabled, lastRunAt, scheduleTime, savedRoutes,
}: {
  websiteId:    string;
  enabled:      boolean;
  lastRunAt:    string | null;
  scheduleTime: string;
  savedRoutes:  string[];
}) {
  const { setAutomation } = useWebsites();
  const [routeInput, setRouteInput] = useState('');
  const [inputError, setInputError] = useState('');

  const summary = enabled
    ? `Runs every day at ${scheduleTime}`
    : 'Automation is off';

  function handleAddRoute() {
    const raw = routeInput.trim();
    if (!raw) return;
    const route = raw.startsWith('/') ? raw : `/${raw}`;
    if (savedRoutes.includes(route)) { setInputError('Already added'); return; }
    setInputError('');
    setRouteInput('');
    setAutomation.mutate({ id: websiteId, routes: [...savedRoutes, route] });
  }

  return (
    <div>
      {/* Section label */}
      <div className="flex items-baseline justify-between gap-[16px] mb-[16px]">
        <h2 className="font-mono text-[12px] tracking-[.14em] uppercase text-ld-text-3 font-semibold">
          Automation
        </h2>
      </div>

      {/* Panel */}
      <div
        className={`rounded-[18px] border bg-ld-surface overflow-hidden shadow-ld-shadow-card transition-[border-color] duration-[250ms] ${enabled ? 'border-ld-accent-line' : 'border-ld-border'}`}
      >
        {/* Top row */}
        <div className="flex items-center gap-[13px] px-[22px] py-[18px]">
          <span className="w-[40px] h-[40px] rounded-[11px] shrink-0 grid place-items-center bg-ld-surface-2 border border-ld-border text-ld-accent">
            <Moon className="w-[19px] h-[19px]" />
          </span>

          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-bold text-ld-text leading-none">Automation Settings</h3>
            <span className="block text-[12.5px] text-ld-text-3 mt-[2px]">{summary}</span>
          </div>

          <Toggle
            enabled={enabled}
            disabled={setAutomation.isPending}
            onChange={() => setAutomation.mutate({ id: websiteId, enabled: !enabled })}
          />
        </div>

        {/* Body */}
        <div className="px-[22px] pb-[22px] border-t border-ld-border">
          {/* 3-field grid */}
          <div className="grid grid-cols-[auto_1fr_1fr] max-[680px]:grid-cols-1 gap-[14px] mt-[18px]">
            <AField label="Schedule">
              <TimePicker
                value={scheduleTime}
                onChange={v => setAutomation.mutate({ id: websiteId, scheduleTime: v })}
              />
            </AField>

            <AField label="Last run">
              <p className={`font-mono text-[16px] font-semibold ${lastRunAt ? 'text-ld-text' : 'text-ld-text-3'}`}>
                {fmtLastRun(lastRunAt)}
              </p>
            </AField>

            <AField label="Next run">
              <p className={`font-mono text-[16px] font-semibold ${enabled ? 'text-ld-accent-2' : 'text-ld-text-3'}`}>
                {enabled ? nextRunLabel(scheduleTime) : 'Paused'}
              </p>
            </AField>
          </div>

          {/* Routes */}
          <div className="mt-[20px]">
            <div className="flex items-baseline justify-between gap-[16px] mb-0">
              <p className="font-mono text-[12px] tracking-[.14em] uppercase text-ld-text-3 font-semibold">
                Routes to audit{' '}
                {savedRoutes.length > 0 && (
                  <span className="text-ld-text-2">· {savedRoutes.length}</span>
                )}
              </p>
            </div>

            {/* Input + Add */}
            <div className="flex gap-[10px] mt-[13px] max-[680px]:flex-col">
              <div className="flex-1 relative">
                <Input
                  icon={<LinkIcon />}
                  mono
                  value={routeInput}
                  onChange={e => { setRouteInput(e.target.value); setInputError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRoute(); } }}
                  placeholder="/dashboard or /settings"
                  error={!!inputError}
                />
                {inputError && (
                  <p className="absolute -bottom-[18px] left-0 text-[11px] text-ld-rose">{inputError}</p>
                )}
              </div>
              <Button
                onClick={handleAddRoute}
                disabled={!routeInput.trim()}
              >
                <Plus /> Add
              </Button>
            </div>

            {/* Empty hint */}
            {savedRoutes.length === 0 && (
              <p className="text-[12.5px] text-ld-text-3 mt-[13px]">
                No routes added yet — type a path above and press Enter or Add.
              </p>
            )}

            {/* Chips */}
            {savedRoutes.length > 0 && (
              <div className="flex flex-wrap gap-[8px] mt-[13px]">
                {savedRoutes.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center gap-[8px] font-mono text-[12.5px] font-medium py-[7px] pl-[12px] pr-[8px] rounded-[9px] border border-ld-accent-line bg-ld-accent-soft text-ld-accent-2"
                  >
                    {r}
                    <button
                      type="button"
                      onClick={() => setAutomation.mutate({ id: websiteId, routes: savedRoutes.filter(x => x !== r) })}
                      className="w-[18px] h-[18px] rounded-[5px] grid place-items-center text-ld-accent-2 transition-colors duration-150 hover:bg-[rgba(20,192,138,0.18)]"
                      aria-label={`Remove ${r}`}
                    >
                      <X className="w-[11px] h-[11px]" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
