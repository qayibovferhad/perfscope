import { useState }           from 'react';
import { Moon, Plus, X, Route, Loader2 } from 'lucide-react';
import { Modal }              from '@/shared/ui/modal/Modal';
import { Input }              from '@/shared/ui/input';
import { Button }             from '@/shared/ui/button';
import { Toggle }             from '@/shared/ui/toggle';
import { TimePicker }         from '@/shared/ui/time-picker';
import { useAutomation }      from '@/features/automation/model/useAutomation';
import { getHostname }        from '@/entities/website';
import type { Website }       from '@/entities/website';

interface Props {
  site:    Website;
  open:    boolean;
  onClose: () => void;
}

export function SetupModal({ site, open, onClose }: Props) {
  const automation = useAutomation(site._id);

  const [routes,       setRoutes]       = useState<string[]>([]);
  const [input,        setInput]        = useState('');
  const [inputError,   setInputError]   = useState('');
  const [enabled,      setEnabled]      = useState(false);
  const [scheduleTime, setScheduleTime] = useState('00:00');

  function handleAdd() {
    const raw = input.trim();
    if (!raw) return;
    const route = raw.startsWith('/') ? raw : `/${raw}`;
    if (routes.includes(route)) { setInputError('Already added'); return; }
    setInputError('');
    setInput('');
    setRoutes(prev => [...prev, route]);
  }

  async function handleSave() {
    await automation.save({ routes, enabled, scheduleTime });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose}>
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

        {/* Schedule time */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2 text-ld-text-3">Run at</p>
          <TimePicker value={scheduleTime} onChange={setScheduleTime} />
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between py-3 px-3 rounded-xl bg-ld-surface-2 border border-ld-border">
          <div>
            <p className="text-xs font-semibold text-ld-text">Enable automation</p>
            <p className="text-[10px] text-ld-text-3">Runs daily at {scheduleTime}</p>
          </div>
          <Toggle
            enabled={enabled}
            onChange={setEnabled}
            disabled={routes.length === 0}
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
