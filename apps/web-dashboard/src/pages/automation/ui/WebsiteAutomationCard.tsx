import { useState }           from 'react';
import { useNavigate }        from 'react-router-dom';
import { motion }             from 'framer-motion';
import { Globe, Plus, X, Link2, ExternalLink, Loader2 } from 'lucide-react';
import { Toggle }             from '@/shared/ui/toggle';
import { TimePicker }         from '@/shared/ui/time-picker';
import { useAutomation }      from '@/features/automation/model/useAutomation';
import { fmtDate, nextRunAt } from '@/features/automation/model/utils';
import { fetchHistoryResult } from '@/entities/history';
import { useAnalysisStore }   from '@/features/analyzer/model/analysisStore';
import { getHostname }        from '@/entities/website';
import type { Website }       from '@/entities/website';

export function WebsiteAutomationCard({ site }: { site: Website }) {
  const navigate  = useNavigate();
  const setResult = useAnalysisStore(s => s.setResult);
  const automation = useAutomation(site._id);

  const auto = site.automation ?? { enabled: false, routes: [], scheduleTime: '00:00', lastRunAt: null };
  const hostname = getHostname(site.url);

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

        <button
          onClick={handleOpenLast}
          disabled={opening}
          className="inline-flex items-center gap-[7px] text-[12.5px] font-semibold text-ld-text-2 px-[13px] py-[7px] rounded-[9px]
                     border border-ld-border-strong bg-ld-surface
                     transition-all duration-200 hover:border-ld-accent-line hover:text-ld-accent
                     disabled:opacity-40"
        >
          {opening ? <Loader2 className="w-[14px] h-[14px] animate-spin" /> : <ExternalLink className="w-[14px] h-[14px]" />}
          Last result
        </button>

        <Toggle
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
            <TimePicker
              value={auto.scheduleTime ?? '00:00'}
              onChange={v => automation.setTime(v)}
            />
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
              {auto.enabled ? nextRunAt(auto.scheduleTime ?? '00:00') : 'Paused'}
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
            <label className="flex-1 flex items-center gap-[10px] px-[14px] rounded-[11px] border border-ld-border-strong bg-ld-bg-2
                              transition-[border-color,box-shadow] duration-200
                              focus-within:border-ld-accent focus-within:shadow-[0_0_0_4px_var(--ld-accent-soft)]">
              <Link2 className="w-[15px] h-[15px] text-ld-text-3 shrink-0" />
              <input
                value={input}
                onChange={e => { setInput(e.target.value); setInputError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRoute(); } }}
                placeholder="/dashboard"
                className="flex-1 bg-transparent border-none outline-none text-ld-text font-mono text-[13.5px] py-3 min-w-0 placeholder:text-ld-text-3"
              />
            </label>
            <button
              onClick={handleAddRoute}
              disabled={!input.trim()}
              className="inline-flex items-center gap-2 font-bold text-[13.5px] px-[18px] rounded-[11px] bg-ld-grad shadow-ld-glow text-ld-grad-text
                         transition-transform duration-150 hover:-translate-y-px disabled:opacity-40"
            >
              <Plus className="w-[15px] h-[15px]" />
              Add
            </button>
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
