import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Moon, Globe, Plus, X, Route, ExternalLink, Loader2, Settings2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui/dialog';
import { Input }       from '@/shared/ui/input';
import { Button }      from '@/shared/ui/button';
import { TimePicker }  from '@/shared/ui/time-picker';
import { useWebsites } from '@/features/dashboard/hooks/useWebsites';
import { fetchHistoryResult } from '@/features/history/hooks/useHistory';
import { useAnalysisStore } from '@/store/analysisStore';
import type { Website } from '@/features/dashboard/hooks/useWebsites';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function nextRunAt(scheduleTime: string): string {
  const [hh, mm] = scheduleTime.split(':').map(Number);
  const now  = new Date();
  const next = new Date();
  next.setHours(hh ?? 0, mm ?? 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function hostname(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

// ─── Setup Modal (Shadcn Dialog) ──────────────────────────────────────────────

function SetupModal({
  site, open, onClose,
}: {
  site: Website; open: boolean; onClose: () => void;
}) {
  const { setAutomation } = useWebsites();

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

  function handleSave() {
    setAutomation.mutate(
      { id: site._id, routes, enabled, scheduleTime },
      { onSuccess: onClose },
    );
  }

  // Reset local state when modal reopens for a fresh site
  function handleOpenChange(o: boolean) {
    if (!o) onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" style={{ background: 'var(--ps-card-bg)', border: '1px solid var(--ps-panel-border)', color: 'var(--ps-text-heading)' }}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(99,102,241,0.15)' }}>
              <Moon className="w-4 h-4" style={{ color: 'var(--ps-accent)' }} />
            </div>
            <div>
              <DialogTitle style={{ color: 'var(--ps-text-heading)' }}>Set up Automation</DialogTitle>
              <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--ps-text-muted)' }}>
                {hostname(site.url)}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Routes */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
              style={{ color: 'var(--ps-text-muted)' }}>
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
                  className="h-8 text-xs font-mono"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${inputError ? '#ef4444' : 'var(--ps-panel-border)'}`,
                    color: 'var(--ps-text-heading)',
                  }}
                />
                {inputError && (
                  <p className="absolute -bottom-4 left-0 text-[10px]" style={{ color: '#ef4444' }}>
                    {inputError}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!input.trim()}
                className="h-8 text-xs"
                style={{ background: 'var(--ps-accent)', color: '#fff' }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>

            {routes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {routes.map(r => (
                  <span key={r}
                    className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md text-[10px] font-mono font-semibold"
                    style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)', color: 'var(--ps-accent)' }}>
                    <Route className="w-2.5 h-2.5 shrink-0" />
                    {r}
                    <button
                      onClick={() => setRoutes(prev => prev.filter(x => x !== r))}
                      className="ml-0.5 w-3.5 h-3.5 rounded flex items-center justify-center hover:bg-red-500/20"
                      style={{ color: 'rgba(239,68,68,0.7)' }}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {routes.length === 0 && (
              <p className="text-[11px] italic mt-3" style={{ color: 'var(--ps-text-muted)' }}>
                Add at least one route to enable automation.
              </p>
            )}
          </div>

          {/* Schedule time */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
              style={{ color: 'var(--ps-text-muted)' }}>
              Run at
            </p>
            <TimePicker value={scheduleTime} onChange={setScheduleTime} />
          </div>

          {/* Enable toggle */}
          <div className="flex items-center justify-between py-3 px-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--ps-divider)' }}>
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--ps-text-heading)' }}>Enable automation</p>
              <p className="text-[10px]" style={{ color: 'var(--ps-text-muted)' }}>
                Runs daily at {scheduleTime}
              </p>
            </div>
            <button
              onClick={() => setEnabled(v => !v)}
              disabled={routes.length === 0}
              className="relative flex items-center transition-opacity disabled:opacity-40"
              style={{ width: 44, height: 24 }}
            >
              <div className="absolute inset-0 rounded-full transition-colors duration-200"
                style={{ background: enabled ? 'var(--ps-accent)' : 'rgba(255,255,255,0.12)' }} />
              <div className="absolute top-0.5 transition-all duration-200 w-5 h-5 rounded-full shadow"
                style={{ left: enabled ? 22 : 2, background: '#fff' }} />
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={routes.length === 0 || setAutomation.isPending}
            className="text-xs"
            style={{ background: 'var(--ps-accent)', color: '#fff' }}
          >
            {setAutomation.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Saving…</> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Unconfigured row ─────────────────────────────────────────────────────────

function UnconfiguredRow({ site, onSetup }: { site: Website; onSetup: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl"
      style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }}>
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          <Globe className="w-3.5 h-3.5" style={{ color: 'var(--ps-text-muted)' }} />
        </div>
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--ps-text-secondary)' }}>
            {site.name || hostname(site.url)}
          </p>
          <p className="text-[10px] font-mono" style={{ color: 'var(--ps-text-muted)' }}>
            {hostname(site.url)}
          </p>
        </div>
      </div>
      <button
        onClick={onSetup}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--ps-accent)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.15)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
      >
        <Settings2 className="w-3.5 h-3.5" /> Set up
      </button>
    </div>
  );
}

// ─── Configured card ──────────────────────────────────────────────────────────

function WebsiteAutomationCard({ site }: { site: Website }) {
  const navigate  = useNavigate();
  const { setAutomation } = useWebsites();
  const setResult = useAnalysisStore(s => s.setResult);

  const automation = site.automation ?? { enabled: false, routes: [], scheduleTime: '00:00', lastRunAt: null };
  const [input,      setInput]      = useState('');
  const [inputError, setInputError] = useState('');
  const [opening,    setOpening]    = useState(false);

  function handleAddRoute() {
    const raw = input.trim();
    if (!raw) return;
    const route = raw.startsWith('/') ? raw : `/${raw}`;
    if (automation.routes.includes(route)) { setInputError('Already added'); return; }
    setInputError('');
    setInput('');
    setAutomation.mutate({ id: site._id, routes: [...automation.routes, route] });
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
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--ps-divider)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: automation.enabled ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)' }}>
            <Globe className="w-4 h-4" style={{ color: automation.enabled ? 'var(--ps-accent)' : 'var(--ps-text-muted)' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--ps-text-heading)' }}>
              {site.name || hostname(site.url)}
            </p>
            <p className="text-[10px] font-mono truncate" style={{ color: 'var(--ps-text-muted)' }}>
              {hostname(site.url)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleOpenLast}
            disabled={opening}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--ps-panel-border)', color: 'var(--ps-text-muted)' }}
          >
            {opening ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
            Last Result
          </button>
          <button
            onClick={() => setAutomation.mutate({ id: site._id, enabled: !automation.enabled })}
            disabled={setAutomation.isPending}
            className="relative flex items-center disabled:opacity-60"
            style={{ width: 44, height: 24 }}
          >
            <div className="absolute inset-0 rounded-full transition-colors duration-200"
              style={{ background: automation.enabled ? 'var(--ps-accent)' : 'rgba(255,255,255,0.12)' }} />
            <div className="absolute top-0.5 transition-all duration-200 w-5 h-5 rounded-full shadow"
              style={{ left: automation.enabled ? 22 : 2, background: '#fff' }} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">

        {/* Schedule + Last + Next */}
        <div className="grid grid-cols-3 gap-3">
          <div className="px-3 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--ps-divider)' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--ps-text-muted)' }}>
              Schedule
            </p>
            <TimePicker
              value={automation.scheduleTime ?? '00:00'}
              onChange={v => setAutomation.mutate({ id: site._id, scheduleTime: v })}
            />
          </div>
          <div className="px-3 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--ps-divider)' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--ps-text-muted)' }}>Last Run</p>
            <p className="text-xs font-semibold" style={{ color: automation.lastRunAt ? 'var(--ps-text-heading)' : 'var(--ps-text-muted)' }}>
              {fmtDate(automation.lastRunAt)}
            </p>
          </div>
          <div className="px-3 py-2 rounded-xl"
            style={{ background: automation.enabled ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${automation.enabled ? 'rgba(99,102,241,0.2)' : 'var(--ps-divider)'}` }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--ps-text-muted)' }}>Next Run</p>
            <p className="text-xs font-semibold" style={{ color: automation.enabled ? 'var(--ps-accent)' : 'var(--ps-text-muted)' }}>
              {automation.enabled ? nextRunAt(automation.scheduleTime ?? '00:00') : '—'}
            </p>
          </div>
        </div>

        {/* Route editor */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--ps-text-muted)' }}>
            Routes {automation.routes.length > 0 && `(${automation.routes.length})`}
          </p>
          <div className="flex gap-2 mb-2.5">
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={e => { setInput(e.target.value); setInputError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRoute(); } }}
                placeholder="/dashboard"
                className="h-8 text-xs font-mono"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${inputError ? '#ef4444' : 'var(--ps-panel-border)'}`,
                  color: 'var(--ps-text-heading)',
                }}
              />
              {inputError && (
                <p className="absolute -bottom-4 left-0 text-[10px]" style={{ color: '#ef4444' }}>{inputError}</p>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleAddRoute}
              disabled={!input.trim()}
              className="h-8 text-xs"
              style={{ background: 'var(--ps-accent)', color: '#fff' }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {automation.routes.map(r => (
              <span key={r}
                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md text-[10px] font-mono font-semibold"
                style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)', color: 'var(--ps-accent)' }}>
                <Route className="w-2.5 h-2.5 shrink-0" />
                {r}
                <button
                  onClick={() => setAutomation.mutate({ id: site._id, routes: automation.routes.filter(x => x !== r) })}
                  className="ml-0.5 w-3.5 h-3.5 rounded flex items-center justify-center hover:bg-red-500/20"
                  style={{ color: 'rgba(239,68,68,0.7)' }}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AutomationPage() {
  const { websites, isLoading } = useWebsites();
  const [setupSite, setSetupSite] = useState<Website | null>(null);

  const configured   = websites.filter(w => (w.automation?.routes ?? []).length > 0 || w.automation?.enabled);
  const unconfigured = websites.filter(w => (w.automation?.routes ?? []).length === 0 && !w.automation?.enabled);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.15)' }}>
            <Moon className="w-5 h-5" style={{ color: 'var(--ps-accent)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--ps-text-heading)' }}>
              Nightly Automation
            </h1>
            <p className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>
              Configure a daily audit schedule per website
            </p>
          </div>
        </div>
        {websites.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--ps-accent)' }}>
              {websites.filter(w => w.automation?.enabled).length} / {websites.length} enabled
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--ps-divider)', color: 'var(--ps-text-muted)' }}>
              {configured.length} configured
            </span>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--ps-accent)' }} />
        </div>
      )}

      {!isLoading && websites.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl"
          style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }}>
          <Globe className="w-8 h-8 mb-3" style={{ color: 'var(--ps-text-muted)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--ps-text-heading)' }}>No websites yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ps-text-muted)' }}>
            Add a website first to configure nightly audits.
          </p>
        </div>
      )}

      {configured.map(site => (
        <WebsiteAutomationCard key={site._id} site={site} />
      ))}

      {unconfigured.length > 0 && (
        <div className="space-y-2">
          {configured.length > 0 && (
            <p className="text-[9px] font-bold uppercase tracking-widest px-1"
              style={{ color: 'var(--ps-text-muted)' }}>
              Not configured
            </p>
          )}
          {unconfigured.map(site => (
            <UnconfiguredRow key={site._id} site={site} onSetup={() => setSetupSite(site)} />
          ))}
        </div>
      )}

      {setupSite && (
        <SetupModal
          site={setupSite}
          open={!!setupSite}
          onClose={() => setSetupSite(null)}
        />
      )}
    </div>
  );
}
