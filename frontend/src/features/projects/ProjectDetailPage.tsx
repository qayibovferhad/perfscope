import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Globe, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronRight, ExternalLink, Activity, BarChart3,
  Clock, Route, RefreshCw, X,
} from 'lucide-react';
import { useProjectAudits, type RouteGroup, type ProjectAuditEntry } from './useProjectAudits';
import { Skeleton } from '@/shared/components/ui/skeleton';

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

function AuditRow({ entry, projectId }: { entry: ProjectAuditEntry; projectId: string }) {
  const navigate = useNavigate();
  const perf     = entry.scores.performance;
  const color    = scoreColor(perf);

  function handleClick() {
    navigate(`/app?url=${encodeURIComponent(entry.url)}&projectId=${projectId}`);
  }

  return (
    <tr
      className="group cursor-pointer transition-colors"
      onClick={handleClick}
      style={{ borderBottom: '1px solid var(--ps-divider)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
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
      <td className="py-3 pr-4">
        <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px]"
          style={{ color: 'var(--ps-accent)' }}>
          <RefreshCw className="w-3 h-3" /> Re-audit
        </span>
      </td>
    </tr>
  );
}

// ─── Route Group Card ─────────────────────────────────────────────────────────

function RouteGroupCard({ group, projectId }: { group: RouteGroup; projectId: string }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }}>
      {/* Route header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
        style={{ borderBottom: open ? '1px solid var(--ps-divider)' : 'none' }}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {open
          ? <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ps-text-muted)' }} />
          : <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ps-text-muted)' }} />
        }
        <code className="text-sm font-mono font-semibold" style={{ color: 'var(--ps-accent)' }}>
          {group.routePath}
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
        {open && (
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
                  {['Date', 'Perf', 'LCP', 'CLS', 'FCP', 'Status', ''].map((h) => (
                    <th key={h} className={`py-2 ${h === 'Date' ? 'pl-4 pr-2' : h === '' ? 'pr-4' : 'px-2'} text-left text-[10px] font-bold uppercase tracking-widest`}
                      style={{ color: 'var(--ps-text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...group.entries].reverse().map((entry) => (
                  <AuditRow key={entry.id} entry={entry} projectId={projectId} />
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
  const [auditOpen, setAuditOpen] = useState(false);

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

      <div className="p-6 max-w-5xl mx-auto space-y-6">
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
              <span className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>
                Click any row to re-audit
              </span>
            </div>
            {groups.map((group) => (
              <RouteGroupCard
                key={group.routePath}
                group={group}
                projectId={project.id}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
