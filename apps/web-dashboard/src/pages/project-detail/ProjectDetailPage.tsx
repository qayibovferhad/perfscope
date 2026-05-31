import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Globe, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronRight, ExternalLink, Activity, BarChart3,
  Clock, Route, RefreshCw, X, GitCompareArrows, CheckSquare, Loader2, Moon,
} from 'lucide-react';
import { useProjectAudits, type RouteGroup, type ProjectAuditEntry } from '@/features/projects/useProjectAudits';
import { Skeleton } from '@/shared/ui/skeleton';
import { CrossWebsitePicker } from '@/features/projects/components/CrossWebsitePicker';
import { setComparePreload } from '@/store/comparePreloadStore';
import { fetchHistoryResult } from '@/features/history/hooks/useHistory';
import { useAnalysisStore } from '@/store/analysisStore';
import { useWebsites } from '@/features/dashboard/useWebsites';
import { Input }      from '@/shared/ui/input';
import { Button }     from '@/shared/ui/button';
import { TimePicker } from '@/shared/ui/time-picker';
import type { AnalysisResult } from '@/entities/analysis';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 90) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Poor';
}

function scoreBg(score: number): string {
  if (score >= 90) return 'rgba(34,197,94,0.12)';
  if (score >= 50) return 'rgba(245,158,11,0.12)';
  return 'rgba(239,68,68,0.12)';
}

function formatLcp(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Trend Badge ──────────────────────────────────────────────────────────────

function TrendBadge({ trend }: { trend: RouteGroup['trend'] }) {
  if (trend === 'improving') return (
    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
      <TrendingUp className="w-3 h-3" /> Improving
    </span>
  );
  if (trend === 'regressing') return (
    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
      <TrendingDown className="w-3 h-3" /> Regressing
    </span>
  );
  if (trend === 'stable') return (
    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(148,163,184,0.12)', color: '#94a3b8' }}>
      <Minus className="w-3 h-3" /> Stable
    </span>
  );
  return null;
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r   = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  const color = scoreColor(score);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ─── Audit Row ────────────────────────────────────────────────────────────────

function AuditRow({
  entry, projectId, compareMode, isSelected, onToggleSelect, onOpen, loadingId,
}: {
  entry: ProjectAuditEntry;
  projectId: string;
  compareMode: boolean;
  isSelected: boolean;
  onToggleSelect: (entry: ProjectAuditEntry) => void;
  onOpen: (entry: ProjectAuditEntry) => void;
  loadingId: string | null;
}) {
  const navigate = useNavigate();
  const perf     = entry.scores.performance;
  const color    = scoreColor(perf);
  const isLoading = loadingId === entry.id;

  function handleClick() {
    if (compareMode) {
      onToggleSelect(entry);
      return;
    }
    navigate(`/app?url=${encodeURIComponent(entry.url)}&projectId=${projectId}`);
  }

  return (
    <tr
      className="group cursor-pointer transition-colors"
      onClick={handleClick}
      style={{
        borderBottom: '1px solid var(--ps-divider)',
        background: isSelected ? 'rgba(99,102,241,0.08)' : 'transparent',
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(99,102,241,0.05)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? 'rgba(99,102,241,0.08)' : 'transparent'; }}
    >
      {compareMode && (
        <td className="py-3 pl-3 pr-1 w-8">
          <div
            className="w-4 h-4 rounded flex items-center justify-center transition-all"
            style={{
              border: isSelected ? '2px solid var(--ps-accent)' : '2px solid rgba(255,255,255,0.2)',
              background: isSelected ? 'var(--ps-accent)' : 'transparent',
            }}
          >
            {isSelected && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
          </div>
        </td>
      )}
      <td className="py-3 pl-4 pr-2">
        <div className="flex flex-col">
          <span className="text-xs font-medium" style={{ color: 'var(--ps-text-heading)' }}>
            {formatDate(entry.timestamp)}
          </span>
          <span className="text-[10px] mt-0.5" style={{ color: 'var(--ps-text-muted)' }}>
            {timeAgo(entry.timestamp)}
          </span>
        </div>
      </td>
      <td className="py-3 px-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold"
          style={{ background: scoreBg(perf), color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          {perf}
        </span>
      </td>
      <td className="py-3 px-2 text-xs font-mono" style={{ color: 'var(--ps-text-secondary)' }}>
        {formatLcp(entry.metrics.lcp)}
      </td>
      <td className="py-3 px-2 text-xs font-mono" style={{ color: 'var(--ps-text-secondary)' }}>
        {entry.metrics.cls.toFixed(2)}
      </td>
      <td className="py-3 px-2 text-xs font-mono" style={{ color: 'var(--ps-text-secondary)' }}>
        {formatLcp(entry.metrics.fcp)}
      </td>
      <td className="py-3 pl-2 pr-4">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: scoreBg(perf), color }}>
          {scoreLabel(perf)}
        </span>
      </td>
      <td className="py-3 pr-3">
        {!compareMode && (
          <div className="flex items-center gap-2 justify-end">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px]"
              style={{ color: 'var(--ps-text-muted)' }}>
              <RefreshCw className="w-3 h-3" /> Re-audit
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onOpen(entry); }}
              disabled={isLoading}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all duration-150 disabled:opacity-50"
              style={{
                background: 'var(--ps-accent-muted)',
                border:     '1px solid var(--ps-accent-border)',
                color:      'var(--ps-accent)',
              }}
              title="Open saved result in Analyzer"
            >
              {isLoading
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <ExternalLink className="w-3 h-3" />}
              View
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Route Group Card ─────────────────────────────────────────────────────────

function RouteGroupCard({
  group, projectId, compareMode, selectedIds, onToggleSelect, onOpen, loadingId,
}: {
  group: RouteGroup;
  projectId: string;
  compareMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (entry: ProjectAuditEntry) => void;
  onOpen: (entry: ProjectAuditEntry) => void;
  loadingId: string | null;
}) {
  const [open, setOpen] = useState(compareMode);

  const isOpen = compareMode ? true : open;

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }}>
      {/* Route header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
        style={{ borderBottom: isOpen ? '1px solid var(--ps-divider)' : 'none' }}
        onClick={() => !compareMode && setOpen((v) => !v)}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {isOpen
          ? <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ps-text-muted)' }} />
          : <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ps-text-muted)' }} />
        }
        <code className="text-sm font-mono font-semibold" style={{ color: 'var(--ps-accent)' }}>
          {group.routePath === '/' ? 'Home' : group.routePath}
        </code>
        <span className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>
          {group.entries.length} audit{group.entries.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <TrendBadge trend={group.trend} />
          <ScoreRing score={group.lastScore} size={40} />
        </div>
      </button>

      {/* Audits table */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ps-divider)' }}>
                  {[...(compareMode ? [''] : []), 'Date', 'Perf', 'LCP', 'CLS', 'FCP', 'Status', ''].map((h, i) => (
                    <th key={`${h}-${i}`}
                      className={`py-2 ${h === 'Date' ? 'pl-4 pr-2' : h === '' ? (i === 0 && compareMode ? 'pl-3 pr-1 w-8' : 'pr-4') : 'px-2'} text-left text-[10px] font-bold uppercase tracking-widest`}
                      style={{ color: 'var(--ps-text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...group.entries].reverse().map((entry) => (
                  <AuditRow
                    key={entry.id}
                    entry={entry}
                    projectId={projectId}
                    compareMode={compareMode}
                    isSelected={selectedIds.has(entry.id)}
                    onToggleSelect={onToggleSelect}
                    onOpen={onOpen}
                    loadingId={loadingId}
                  />
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── New Audit Modal ──────────────────────────────────────────────────────────

function NewAuditModal({
  open,
  baseUrl,
  projectId,
  onClose,
}: {
  open:      boolean;
  baseUrl:   string;
  projectId: string;
  onClose:   () => void;
}) {
  const navigate  = useNavigate();
  const [route, setRoute] = useState('/');

  const trimmed  = route.trim() || '/';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const fullUrl  = baseUrl.replace(/\/$/, '') + withSlash;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onClose();
    navigate(`/app?url=${encodeURIComponent(fullUrl)}&projectId=${projectId}`);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: 'var(--ps-card-bg)', border: '1px solid var(--ps-panel-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: 'var(--ps-text-heading)' }}>New Audit</h2>
          <button onClick={onClose} style={{ color: 'var(--ps-text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--ps-text-muted)' }}>
              Route Path
            </label>
            <input
              type="text"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              placeholder="/dashboard"
              className="w-full px-3 py-2.5 rounded-lg text-sm font-mono outline-none"
              style={{
                background: 'var(--ps-input-bg, rgba(255,255,255,0.05))',
                border:     '1px solid var(--ps-panel-border)',
                color:      'var(--ps-text-heading)',
              }}
              autoFocus
            />
          </div>

          <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--ps-accent)' }}>
              Will analyze
            </p>
            <p className="text-xs font-mono break-all" style={{ color: 'var(--ps-text-secondary)' }}>
              {fullUrl}
            </p>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold ps-btn-primary"
          >
            <Activity className="w-4 h-4" /> Start Audit
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'var(--ps-accent-muted)' }}>
        <span style={{ color: 'var(--ps-accent)' }}>{icon}</span>
      </div>
      <div>
        <p className="text-xl font-bold leading-none" style={{ color: 'var(--ps-text-heading)' }}>{value}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--ps-text-muted)' }}>{label}</p>
        {sub && <p className="text-[10px]" style={{ color: 'var(--ps-text-muted)' }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Automation Card ─────────────────────────────────────────────────────────

function AutomationCard({
  websiteId,
  enabled,
  lastRunAt,
  scheduleTime,
  savedRoutes,
}: {
  websiteId:    string;
  enabled:      boolean;
  lastRunAt:    string | null;
  scheduleTime: string;
  savedRoutes:  string[];
}) {
  const { setAutomation } = useWebsites();
  const [input,      setInput]      = useState('');
  const [inputError, setInputError] = useState('');

  function handleAddRoute() {
    const raw = input.trim();
    if (!raw) return;
    const route = raw.startsWith('/') ? raw : `/${raw}`;
    if (savedRoutes.includes(route)) { setInputError('Already added'); return; }
    setInputError('');
    setInput('');
    setAutomation.mutate({ id: websiteId, routes: [...savedRoutes, route] });
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function nextRunAt(t: string): string {
    const [hh, mm] = t.split(':').map(Number);
    const now = new Date();
    const next = new Date();
    next.setHours(hh ?? 0, mm ?? 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--ps-divider)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: enabled ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)' }}>
            <Moon className="w-4 h-4" style={{ color: enabled ? 'var(--ps-accent)' : 'var(--ps-text-muted)' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ps-text-heading)' }}>
              Automation Settings
            </p>
            <p className="text-[10px]" style={{ color: 'var(--ps-text-muted)' }}>
              Daily audit — runs at {scheduleTime}
            </p>
          </div>
        </div>
        <button
          onClick={() => setAutomation.mutate({ id: websiteId, enabled: !enabled })}
          disabled={setAutomation.isPending}
          className="relative flex items-center transition-opacity disabled:opacity-60"
          style={{ width: 44, height: 24 }}
        >
          <div className="absolute inset-0 rounded-full transition-colors duration-200"
            style={{ background: enabled ? 'var(--ps-accent)' : 'rgba(255,255,255,0.12)' }} />
          <div className="absolute top-0.5 transition-all duration-200 w-5 h-5 rounded-full shadow"
            style={{ left: enabled ? 22 : 2, background: '#fff' }} />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">

        {/* Schedule + Last + Next */}
        <div className="grid grid-cols-3 gap-3">
          <div className="px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--ps-divider)' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--ps-text-muted)' }}>Schedule</p>
            <TimePicker
              value={scheduleTime}
              onChange={v => setAutomation.mutate({ id: websiteId, scheduleTime: v })}
            />
          </div>
          <div className="px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--ps-divider)' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--ps-text-muted)' }}>Last Run</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: lastRunAt ? 'var(--ps-text-heading)' : 'var(--ps-text-muted)' }}>
              {fmtDate(lastRunAt)}
            </p>
          </div>
          <div className="px-3 py-2.5 rounded-xl"
            style={{ background: enabled ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${enabled ? 'rgba(99,102,241,0.2)' : 'var(--ps-divider)'}` }}>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--ps-text-muted)' }}>Next Run</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: enabled ? 'var(--ps-accent)' : 'var(--ps-text-muted)' }}>
              {enabled ? nextRunAt(scheduleTime) : '—'}
            </p>
          </div>
        </div>

        {/* Route editor */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--ps-text-muted)' }}>
            Routes to audit {savedRoutes.length > 0 && `(${savedRoutes.length})`}
          </p>
          <div className="flex gap-2 mb-3">
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={e => { setInput(e.target.value); setInputError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRoute(); } }}
                placeholder="/dashboard or /settings"
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

          {savedRoutes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {savedRoutes.map((r) => (
                <span key={r}
                  className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md text-[10px] font-mono font-semibold"
                  style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)', color: 'var(--ps-accent)' }}>
                  <Route className="w-2.5 h-2.5 shrink-0" />
                  {r}
                  <button
                    onClick={() => setAutomation.mutate({ id: websiteId, routes: savedRoutes.filter(x => x !== r) })}
                    className="ml-0.5 w-3.5 h-3.5 rounded flex items-center justify-center hover:bg-red-500/20"
                    style={{ color: 'rgba(239,68,68,0.7)' }}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] italic" style={{ color: 'var(--ps-text-muted)' }}>
              No routes added yet — type a path above and press Enter or Add.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Skeleton className="h-6 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ProjectDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { data, isLoading, isError } = useProjectAudits(id!);
  const { websites } = useWebsites();
  const [auditOpen,     setAuditOpen]     = useState(false);
  const [compareMode,   setCompareMode]   = useState(false);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [crossSiteOpen, setCrossSiteOpen] = useState(false);
  const [loadingId,     setLoadingId]     = useState<string | null>(null);

  const setResult = useAnalysisStore(s => s.setResult);

  async function handleOpenInAnalyzer(entry: ProjectAuditEntry) {
    setLoadingId(entry.id);
    try {
      const result = await fetchHistoryResult(entry.id);
      setResult(result, entry.url);
      navigate('/app');
    } catch {
      // result not stored — silently ignore
    } finally {
      setLoadingId(null);
    }
  }

  const allAudits = useMemo(
    () => (data?.groups ?? []).flatMap((g) => g.entries),
    [data?.groups],
  );

  const selectedAudits = useMemo(
    () => allAudits.filter((a) => selectedIds.has(a.id)),
    [allAudits, selectedIds],
  );

  if (isLoading) return <PageSkeleton />;

  if (isError || !data) {
    return (
      <div className="p-6 max-w-5xl mx-auto flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--ps-text-heading)' }}>Project not found</p>
        <Link to="/websites" className="text-sm" style={{ color: 'var(--ps-accent)' }}>← Back to Websites</Link>
      </div>
    );
  }

  const { project, groups, stats } = data;
  const hostname = (() => { try { return new URL(project.url).hostname; } catch { return project.url; } })();

  function toAnalysisResult(entry: ProjectAuditEntry): AnalysisResult {
    return { id: entry.id, url: entry.url, timestamp: entry.timestamp, scores: entry.scores, metrics: entry.metrics, audits: [] };
  }

  function launchCompare(a: ProjectAuditEntry, b: ProjectAuditEntry) {
    setComparePreload({ target: toAnalysisResult(a), competitor: toAnalysisResult(b) });
    navigate('/compare');
  }

  function toggleSelect(entry: ProjectAuditEntry) {
    const next = new Set(selectedIds);
    if (next.has(entry.id)) {
      next.delete(entry.id);
      setSelectedIds(next);
      return;
    }
    if (next.size >= 2) return;
    next.add(entry.id);
    setSelectedIds(next);
  }

  function exitCompareMode() {
    setCompareMode(false);
    setSelectedIds(new Set());
  }

  function handleCrossSiteSelect(entry: ProjectAuditEntry) {
    setCrossSiteOpen(false);
    if (selectedAudits.length === 1) {
      launchCompare(selectedAudits[0]!, entry);
      exitCompareMode();
    }
  }

  return (
    <>
      <AnimatePresence>
        {auditOpen && (
          <NewAuditModal
            open={auditOpen}
            baseUrl={project.url}
            projectId={project.id}
            onClose={() => setAuditOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {crossSiteOpen && (
          <CrossWebsitePicker
            excludeProjectId={id!}
            onSelect={handleCrossSiteSelect}
            onClose={() => setCrossSiteOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className={`p-6 max-w-5xl mx-auto space-y-6 ${compareMode ? 'pb-28' : ''}`}>
        {/* Back */}
        <button
          onClick={() => navigate('/websites')}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: 'var(--ps-text-muted)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-heading)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-muted)')}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> My Websites
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--ps-accent-muted)' }}>
              <Globe className="w-6 h-6" style={{ color: 'var(--ps-accent)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--ps-text-heading)' }}>
                {project.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-mono" style={{ color: 'var(--ps-text-muted)' }}>{hostname}</span>
                <a href={project.url} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--ps-text-muted)' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-accent)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-muted)')}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {stats.totalAudits > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: scoreBg(stats.avgPerformance), border: `1px solid ${scoreColor(stats.avgPerformance)}33` }}>
                <span className="text-sm font-bold" style={{ color: scoreColor(stats.avgPerformance) }}>
                  {stats.avgPerformance}
                </span>
                <span className="text-xs" style={{ color: scoreColor(stats.avgPerformance) }}>
                  Avg Performance
                </span>
              </div>
            )}
            {stats.totalAudits >= 2 && (
              <button
                onClick={() => { setCompareMode((v) => !v); setSelectedIds(new Set()); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={compareMode ? {
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.4)',
                  color: 'var(--ps-accent)',
                } : {
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--ps-panel-border)',
                  color: 'var(--ps-text-secondary)',
                }}
              >
                <GitCompareArrows className="w-4 h-4" />
                {compareMode ? 'Exit Compare' : 'Compare'}
              </button>
            )}
            <button
              onClick={() => setAuditOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ps-btn-primary"
            >
              <Plus className="w-4 h-4" /> New Audit
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Audits"   value={stats.totalAudits}    icon={<BarChart3  className="w-4 h-4" />} />
          <StatCard label="Unique Routes"  value={stats.uniqueRoutes}   icon={<Route      className="w-4 h-4" />} />
          <StatCard label="Avg Score"      value={stats.totalAudits ? stats.avgPerformance : '—'} icon={<Activity   className="w-4 h-4" />} />
          <StatCard label="Last Audit"     value={timeAgo(stats.lastAuditAt)} icon={<Clock      className="w-4 h-4" />} />
        </div>

        {/* Empty state */}
        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl"
            style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--ps-accent-muted)' }}>
              <Activity className="w-7 h-7" style={{ color: 'var(--ps-accent)' }} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ps-text-heading)' }}>
              No audits yet
            </p>
            <p className="text-xs mb-5" style={{ color: 'var(--ps-text-muted)' }}>
              Run your first audit to start tracking performance across routes
            </p>
            <button
              onClick={() => setAuditOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ps-btn-primary"
            >
              <Plus className="w-4 h-4" /> New Audit
            </button>
          </div>
        )}

        {/* Route groups */}
        {groups.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--ps-text-muted)' }}>
                Audit History by Route
              </h2>
              {compareMode ? (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ps-accent)' }}>
                  <CheckSquare className="w-3.5 h-3.5" />
                  Select 2 audits to compare
                </span>
              ) : (
                <span className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>
                  Click any row to re-audit
                </span>
              )}
            </div>
            {groups.map((group) => (
              <RouteGroupCard
                key={group.routePath}
                group={group}
                projectId={project.id}
                compareMode={compareMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onOpen={handleOpenInAnalyzer}
                loadingId={loadingId}
              />
            ))}
          </div>
        )}

        {/* Automation Settings — bottom of page */}
        {(() => {
          const website = websites.find(w => w._id === project.id);
          if (!website) return null;
          return (
            <AutomationCard
              websiteId={project.id}
              enabled={website.automation?.enabled ?? false}
              lastRunAt={website.automation?.lastRunAt ?? null}
              scheduleTime={website.automation?.scheduleTime ?? '00:00'}
              savedRoutes={website.automation?.routes ?? []}
            />
          );
        })()}
      </div>

      {/* Floating compare bar */}
      <AnimatePresence>
        {compareMode && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
            style={{
              background: '#111827',
              border: '1px solid rgba(99,102,241,0.35)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.2)',
            }}
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[0, 1].map((i) => (
                  <div key={i} className="w-5 h-5 rounded flex items-center justify-center transition-all"
                    style={{
                      background: selectedIds.size > i ? 'var(--ps-accent)' : 'rgba(255,255,255,0.08)',
                      border: selectedIds.size > i ? 'none' : '1px solid rgba(255,255,255,0.15)',
                    }}>
                    {selectedIds.size > i && <span className="text-white text-[10px] font-bold">✓</span>}
                  </div>
                ))}
              </div>
              <span className="text-xs font-semibold" style={{ color: 'var(--ps-text-secondary)' }}>
                {selectedIds.size}/2 selected
              </span>
            </div>

            <div className="w-px h-4" style={{ background: 'var(--ps-divider)' }} />

            {selectedIds.size === 1 && (
              <button
                onClick={() => setCrossSiteOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--ps-text-secondary)', border: '1px solid var(--ps-panel-border)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)')}
              >
                <Globe className="w-3.5 h-3.5" />
                Compare with another website
              </button>
            )}

            {selectedIds.size < 2 && (
              <span className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>
                {selectedIds.size === 0 ? 'Select 2 audits' : 'Select 1 more'}
              </span>
            )}

            {selectedIds.size === 2 && (
              <button
                onClick={() => {
                  const entries = allAudits.filter((a) => selectedIds.has(a.id));
                  if (entries.length === 2) launchCompare(entries[0]!, entries[1]!);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'var(--ps-accent)', color: '#fff' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.9')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
              >
                <GitCompareArrows className="w-3.5 h-3.5" />
                Compare
              </button>
            )}

            <button
              onClick={exitCompareMode}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--ps-text-muted)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-heading)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-muted)')}
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
