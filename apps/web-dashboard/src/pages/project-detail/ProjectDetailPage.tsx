import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Globe, ExternalLink, Activity, BarChart3,
  Clock, Route, GitCompareArrows, CheckSquare,
} from 'lucide-react';
import { useProjectAudits, type ProjectAuditEntry } from '@/features/projects/model/useProjectAudits';
import { CrossWebsitePicker }   from '@/widgets/cross-website-picker';
import { getHostname }          from '@/entities/website';
import { setComparePreload }    from '@/features/compare/model/comparePreloadStore';
import { fetchHistoryResult }   from '@/features/history/hooks/useHistory';
import { useAnalysisStore }     from '@/features/analyzer/model/analysisStore';
import { useWebsites }          from '@/features/dashboard/hooks/useWebsites';
import { Button }               from '@/shared/ui/button';
import { StatCard }             from '@/features/projects/ui/StatCard';
import { RouteGroupCard }       from '@/features/projects/ui/RouteGroupCard';
import { NewAuditModal }        from '@/features/projects/ui/NewAuditModal';
import { AutomationCard }       from '@/features/automation/ui/AutomationCard';
import { CompareBar }           from './ui/CompareBar';
import { ProjectDetailSkeleton } from './ui/ProjectDetailSkeleton';
import { timeAgo }              from '@/features/projects/lib/formatters';
import type { AnalysisResult }  from '@/entities/analysis';

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

  if (isLoading) return <ProjectDetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="p-6 max-w-5xl mx-auto flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm font-medium mb-2 text-ld-text">Project not found</p>
        <Link to="/websites" className="text-sm text-ld-accent">← Back to Websites</Link>
      </div>
    );
  }

  const { project, groups, stats } = data;
  const hostname = getHostname(project.url);

  function toAnalysisResult(entry: ProjectAuditEntry): AnalysisResult {
    return { id: entry.id, url: entry.url, timestamp: entry.timestamp, scores: entry.scores, metrics: entry.metrics, audits: [] };
  }

  function launchCompare(a: ProjectAuditEntry, b: ProjectAuditEntry) {
    setComparePreload({ target: toAnalysisResult(a), competitor: toAnalysisResult(b) });
    navigate('/compare');
  }

  function toggleSelect(entry: ProjectAuditEntry) {
    const next = new Set(selectedIds);
    if (next.has(entry.id)) { next.delete(entry.id); setSelectedIds(next); return; }
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

  const website = websites.find(w => w._id === project.id);

  return (
    <>
      <NewAuditModal
        open={auditOpen}
        baseUrl={project.url}
        projectId={project.id}
        onClose={() => setAuditOpen(false)}
      />

      <AnimatePresence>
        {crossSiteOpen && (
          <CrossWebsitePicker
            excludeProjectId={id!}
            onSelect={handleCrossSiteSelect}
            onClose={() => setCrossSiteOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className={`px-[clamp(22px,4vw,48px)] pt-[30px] pb-[80px] w-[min(1080px,100%)] mx-auto flex flex-col gap-[44px] ${compareMode ? '!pb-28' : ''}`}>
        {/* ── Header section: back link + title ─────────── */}
        <div className="flex flex-col gap-[18px]">
          <button
            onClick={() => navigate('/websites')}
            className="inline-flex items-center gap-[8px] text-[13.5px] font-medium text-ld-text-3 self-start transition-[color,gap] duration-200 hover:text-ld-accent hover:gap-[11px]"
          >
            <ArrowLeft className="w-[15px] h-[15px] shrink-0" />
            My Websites
          </button>

        {/* Site header */}
        <div className="flex items-center gap-[16px] flex-wrap">
          {/* Favicon tile */}
          <span className="w-[54px] h-[54px] rounded-[15px] shrink-0 grid place-items-center bg-ld-surface-2 border border-ld-border text-ld-accent">
            <Globe className="w-[26px] h-[26px]" />
          </span>

          {/* Name + URL */}
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-[clamp(24px,3.2vw,32px)] font-extrabold tracking-[-0.03em] text-ld-text leading-none">
              {project.name}
            </h1>
            <span className="inline-flex items-center gap-[7px] font-mono text-[13.5px] text-ld-text-3 mt-[5px]">
              {hostname}
              <a
                href={project.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex text-ld-text-3 transition-colors duration-200 hover:text-ld-accent"
                aria-label="Open site"
              >
                <ExternalLink className="w-[14px] h-[14px]" />
              </a>
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-[11px] flex-wrap">
            {/* Avg performance badge */}
            {stats.totalAudits > 0 && (() => {
              const s = stats.avgPerformance;
              const band = s >= 90 ? 'good' : s >= 50 ? 'warn' : 'poor';
              const cls = band === 'good'
                ? 'text-ld-accent-2 border-ld-accent-line bg-ld-accent-soft [data-theme=light]_:text-ld-accent'
                : band === 'warn'
                ? 'text-ld-amber border-[rgba(230,162,60,0.3)] bg-[rgba(230,162,60,0.1)]'
                : 'text-ld-rose border-[rgba(242,100,122,0.3)] bg-[rgba(242,100,122,0.1)]';
              return (
                <span className={`inline-flex items-center gap-[8px] text-[13px] font-semibold px-[14px] py-[8px] rounded-full border ${cls}`}>
                  <b className="font-mono font-bold">{s}</b>
                  Avg performance
                </span>
              );
            })()}

            {/* Compare toggle */}
            {stats.totalAudits >= 2 && (
              <Button
                variant={compareMode ? 'default' : 'outline'}
                onClick={() => { setCompareMode((v) => !v); setSelectedIds(new Set()); }}
              >
                <GitCompareArrows className="w-[15px] h-[15px]" />
                {compareMode ? 'Exit Compare' : 'Compare'}
              </Button>
            )}

            {/* New Audit */}
            <Button onClick={() => setAuditOpen(true)}>
              <Plus /> New Audit
            </Button>
          </div>
        </div>
        </div>{/* end header section */}

        {/* ── Summary strip ─────────────────────────────── */}
        <div className="grid grid-cols-1 min-[680px]:grid-cols-2 min-[920px]:grid-cols-4 gap-[14px]">
          <StatCard label="Total Audits"  value={stats.totalAudits}   icon={<BarChart3 className="w-5 h-5" />} />
          <StatCard label="Unique Routes" value={stats.uniqueRoutes}  icon={<Route     className="w-5 h-5" />} />
          <StatCard label="Avg Score"     value={stats.totalAudits ? stats.avgPerformance : '—'} icon={<Activity className="w-5 h-5" />} />
          <StatCard label="Last Audit"    value={timeAgo(stats.lastAuditAt)} icon={<Clock className="w-5 h-5" />} compact />
        </div>

        {/* Empty state */}
        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl bg-ld-surface border border-ld-border">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-ld-accent-soft">
              <Activity className="w-7 h-7 text-ld-accent" />
            </div>
            <p className="text-sm font-semibold mb-1 text-ld-text">
              No audits yet
            </p>
            <p className="text-xs mb-5 text-ld-text-3">
              Run your first audit to start tracking performance across routes
            </p>
            <Button onClick={() => setAuditOpen(true)}>
              <Plus /> New Audit
            </Button>
          </div>
        )}

        {/* Route groups */}
        {groups.length > 0 && (
          <div>
            {/* Section head */}
            <div className="flex items-baseline justify-between gap-[16px] mb-[16px] flex-wrap">
              <h2 className="font-mono text-[12px] tracking-[.14em] uppercase text-ld-text-3 font-semibold whitespace-nowrap">
                Audit history by route
              </h2>
              <span className="text-[12.5px] text-ld-text-3">
                {compareMode ? (
                  <span className="flex items-center gap-[6px] text-ld-accent">
                    <CheckSquare className="w-[13px] h-[13px]" />
                    Select 2 audits to compare
                  </span>
                ) : 'Open a route to see its full audit table'}
              </span>
            </div>

            {/* Route accordion list */}
            <div className="grid gap-[11px]">
              {groups.map((group, i) => (
                <RouteGroupCard
                  key={group.routePath}
                  group={group}
                  projectId={project.id}
                  compareMode={compareMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onOpen={handleOpenInAnalyzer}
                  loadingId={loadingId}
                  initialOpen={i === 0}
                />
              ))}
            </div>
          </div>
        )}

        {/* Automation Settings */}
        {website && (
          <AutomationCard
            websiteId={project.id}
            enabled={website.automation?.enabled ?? false}
            lastRunAt={website.automation?.lastRunAt ?? null}
            scheduleTime={website.automation?.scheduleTime ?? '00:00'}
            savedRoutes={website.automation?.routes ?? []}
          />
        )}
      </div>

      {/* Floating compare bar */}
      <AnimatePresence>
        {compareMode && (
          <CompareBar
            selectedCount={selectedIds.size}
            onCrossSite={() => setCrossSiteOpen(true)}
            onCompare={() => {
              const entries = allAudits.filter((a) => selectedIds.has(a.id));
              if (entries.length === 2) launchCompare(entries[0]!, entries[1]!);
            }}
            onExit={exitCompareMode}
          />
        )}
      </AnimatePresence>
    </>
  );
}
