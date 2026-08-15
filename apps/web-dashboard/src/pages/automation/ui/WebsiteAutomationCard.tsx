import { useState }           from 'react';
import { useNavigate }        from 'react-router-dom';
import { motion }             from 'framer-motion';
import { Globe, Plus, X, Link2, ExternalLink, Loader2, SlidersHorizontal } from 'lucide-react';
import { expandSchedule }     from '@perfscope/shared';
import { Button }             from '@/shared/ui/button';
import { Input }              from '@/shared/ui/input';
import { Toggle }             from '@/shared/ui/toggle';
import { TimePicker }         from '@/shared/ui/time-picker';
import { useAutomation }      from '@/features/automation';
import { fmtDate, nextRunAt } from '@/features/automation';
import { fetchHistoryResult } from '@/entities/history';
import { useAnalysisStore }   from '@/features/analyzer';
import { getHostname }        from '@/entities/website';
import type { Website }       from '@/entities/website';

export function WebsiteAutomationCard({ site, onConfigure }: { site: Website; onConfigure: () => void }) {
  const navigate  = useNavigate();
  const setResult = useAnalysisStore(s => s.setResult);
  const automation = useAutomation(site._id);

  const auto = site.automation ?? { enabled: false, routes: [], scheduleTime: '00:00', lastRunAt: null };
  const hostname = getHostname(site.url);
  const timetable = expandSchedule(auto);

  const [input,      setInput]      = useState('');
  const [inputError, setInputError] = useState('');
  const [opening,    setOpening]    = useState(false);

  function handleAddRoute() {
    const raw = input.trim();
    if (!raw) return;
    const route = raw.startsWith('/') ? raw : `/${raw}`;
    if (auto.routes.includes(route)) { setInputError('Already added'); return; }
    setInputError('');
    setInput('');
    automation.setRoutes([...auto.routes, route]);
  }

  async function handleOpenLast() {
    setOpening(true);
    try {
      const result = await fetchHistoryResult(site._id);
      setResult(result, site.url);
      navigate('/app');
    } catch { /* no stored result */ } finally { setOpening(false); }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-[18px] border bg-ld-surface shadow-ld-shadow-card overflow-hidden transition-colors duration-[250ms] ${
        auto.enabled ? 'border-ld-accent-line' : 'border-ld-border'
      }`}
    >
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-[13px] px-5 py-[18px]">
        <div className="w-[42px] h-[42px] rounded-[11px] grid place-items-center shrink-0 bg-ld-surface-2 border border-ld-border text-ld-accent">
          <Globe className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-[16.5px] font-bold text-ld-text truncate">{site.name || hostname}</h3>
          <span className="block font-mono text-[12.5px] text-ld-text-3 mt-0.5 truncate">{hostname}</span>
        </div>

        <Button variant="outline" size="sm" onClick={handleOpenLast} disabled={opening}>
          {opening ? <Loader2 className="animate-spin" /> : <ExternalLink />}
          Last result
        </Button>

        {/* Setup was previously reachable only for sites with nothing configured, so a
            timetable could be created and then never edited again. */}
        <Button variant="outline" size="sm" onClick={onConfigure}>
          <SlidersHorizontal />
          Configure
        </Button>

        <Toggle
          label={`Scheduled audits for ${site.name || site.url}`}
          enabled={auto.enabled}
          onChange={e => automation.toggle(e)}
          disabled={automation.isSaving}
        />
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="px-5 pb-5 border-t border-ld-border">

        {/* 3-field grid */}
        <div className="grid grid-cols-[auto_1fr_1fr] gap-[14px] mt-[18px]">
          <div className="px-4 py-[14px] rounded-[13px] border border-ld-border bg-ld-surface-2">
            <p className="font-mono text-[10px] tracking-[.12em] uppercase text-ld-text-3 mb-[10px]">Schedule</p>
            {/* Only one time can be edited in place. A timetable is set up in the modal —
                showing a lone picker there would imply the other slots do not exist. */}
            {(auto.scheduleMode ?? 'single') === 'single' ? (
              <TimePicker
                value={auto.scheduleTime ?? '00:00'}
                onChange={v => automation.setTime(v)}
              />
            ) : (
              <div className="min-w-[132px]">
                <p className="font-mono text-[16px] font-semibold text-ld-accent-2 leading-none">
                  {timetable.length} slot{timetable.length === 1 ? '' : 's'}
                </p>
                <p className="font-mono text-[10px] text-ld-text-3 mt-[6px] leading-[1.4] break-all">
                  {timetable.map(s => s.time).join(' · ') || '—'}
                </p>
              </div>
            )}
          </div>

          <div className="px-4 py-[14px] rounded-[13px] border border-ld-border bg-ld-surface-2">
            <p className="font-mono text-[10px] tracking-[.12em] uppercase text-ld-text-3 mb-[10px]">Last run</p>
            <p className={`font-mono text-[16px] font-semibold ${auto.lastRunAt ? 'text-ld-text' : 'text-ld-text-3'}`}>
              {fmtDate(auto.lastRunAt)}
            </p>
          </div>

          <div className="px-4 py-[14px] rounded-[13px] border border-ld-border bg-ld-surface-2">
            <p className="font-mono text-[10px] tracking-[.12em] uppercase text-ld-text-3 mb-[10px]">Next run</p>
            <p className={`font-mono text-[16px] font-semibold ${auto.enabled ? 'text-ld-accent-2' : 'text-ld-text-3'}`}>
              {auto.enabled ? nextRunAt(auto) : 'Paused'}
            </p>
          </div>
        </div>

        {/* Routes */}
        <div className="mt-5">
          <div className="flex items-center gap-[10px] font-mono text-[11px] tracking-[.14em] uppercase text-ld-text-3 mb-3">
            Routes
            {auto.routes.length > 0 && <span className="text-ld-text-2">· {auto.routes.length}</span>}
            <div className="flex-1 h-px bg-ld-border" />
          </div>

          <div className="flex gap-[10px]">
            <Input
              icon={<Link2 />}
              mono
              value={input}
              onChange={e => { setInput(e.target.value); setInputError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRoute(); } }}
              placeholder="/dashboard"
              className="text-[13.5px]"
              wrapperClassName="flex-1"
            />
            <Button onClick={handleAddRoute} disabled={!input.trim()} className="h-auto px-[18px]">
              <Plus />
              Add
            </Button>
          </div>

          {inputError && <p className="text-[11px] text-ld-rose mt-1.5">{inputError}</p>}

          {auto.routes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-[13px]">
              {auto.routes.map(r => (
                <span key={r}
                  className="inline-flex items-center gap-2 font-mono text-[12.5px] font-medium pl-3 pr-1 py-[7px] rounded-[9px] border border-ld-accent-line bg-ld-accent-soft text-ld-accent-2">
                  <Link2 className="w-[13px] h-[13px] opacity-80" />
                  {r}
                  <button
                    onClick={() => automation.setRoutes(auto.routes.filter(x => x !== r))}
                    className="w-[18px] h-[18px] rounded-[5px] grid place-items-center transition-colors hover:bg-ld-accent-hover"
                  >
                    <X className="w-[11px] h-[11px]" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
