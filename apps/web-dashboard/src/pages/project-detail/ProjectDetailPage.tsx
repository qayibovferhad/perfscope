import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Globe, ExternalLink, Activity, BarChart3,
  Clock, Route, GitCompareArrows, CheckSquare, Lock, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { useProjectAudits, type ProjectAuditEntry } from '@/features/projects';
import { CrossWebsitePicker }   from '@/widgets/cross-website-picker';
import { getHostname, sessionState } from '@/entities/website';
import { useAdviceContext } from '@/features/advisor';
import { setComparePreload }    from '@/features/compare';
import { fetchHistoryResult }   from '@/entities/history';
import { useAnalysisStore }     from '@/features/analyzer';
import { useWebsites }          from '@/entities/website';
import { Button }               from '@/shared/ui/button';
import { StatCard }             from '@/shared/ui/stat-card';
import { StatePanel, QueryErrorPanel } from '@/shared/ui/state-panel';
import { TabBar }               from '@/shared/ui/tab-bar';
import { RouteGroupCard }       from '@/features/projects';
import { NewAuditModal }        from '@/features/projects';
import { SessionCaptureModal }  from '@/features/auth-audit';
import { RumPanel }             from '@/features/rum';
import { hasResult }            from '@perfscope/shared';
import { CompareBar }           from './ui/CompareBar';
import { ProjectDetailSkeleton } from './ui/ProjectDetailSkeleton';
import { timeAgo }              from '@/features/projects';
import { scoreBand, type AnalysisResult } from '@/entities/analysis';

type ProjectTab = 'audits' | 'field';

export function ProjectDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { data, isLoading, isError, refetch } = useProjectAudits(id!);
  const { websites } = useWebsites();

  const [auditOpen,     setAuditOpen]     = useState(false);
  const [sessionOpen,   setSessionOpen]   = useState(false);
  const [compareMode,   setCompareMode]   = useState(false);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [crossSiteOpen, setCrossSiteOpen] = useState(false);
  const [loadingId,     setLoadingId]     = useState<string | null>(null);

  // In the URL so a reload, a back button or a shared link lands on the same tab.
  const [params, setParams] = useSearchParams();
  const tab: ProjectTab = params.get('tab') === 'field' ? 'field' : 'audits';

  function setTab(next: ProjectTab) {
    // The floating compare bar belongs to the audit table; leaving it armed while the
    // field panel is showing offers a "Compare" button with nothing to compare.
    if (next !== 'audits') exitCompareMode();
    setParams(p => {
      const n = new URLSearchParams(p);
      if (next === 'audits') n.delete('tab'); else n.set('tab', next);
      return n;
    }, { replace: true });
  }

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

  // Newest audit that actually produced numbers — the lab side of the field comparison.
  const latestLab = useMemo(() => {
    const scored = allAudits
      .filter(hasResult)
      .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
    const last = scored.at(-1);
    return last ? { lcp: last.metrics.lcp, cls: last.metrics.cls, fcp: last.metrics.fcp } : null;
  }, [allAudits]);

  const selectedAudits = useMemo(
    () => allAudits.filter((a) => selectedIds.has(a.id)),
    [allAudits, selectedIds],
  );

  // Resolved here rather than after the guards below: this page returns early while it
  // loads, and a hook cannot sit behind a conditional return.
  const website = websites.find(w => w._id === id);

  // The whole page is about this site, so the advisor should be too.
  useAdviceContext(website ? { scope: 'site', url: website.url, label: getHostname(website.url) } : null);

  if (isLoading) return <ProjectDetailSkeleton />;

  // A failed request and a project that does not exist are different problems: one is
  // worth retrying, the other means the link is dead. Reporting both as "not found" sent
  // users hunting for a deleted project whenever the backend hiccuped.
  if (isError) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <QueryErrorPanel what="this project" onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <StatePanel
          variant="error"
          title="Project not found"
          description="This project may have been deleted, or the link is out of date."
          action={
            <Button variant="outline" size="md" asChild>
              <Link to="/websites"><ArrowLeft /> Back to Websites</Link>
            </Button>
          }
        />
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

  const session = sessionState(website);

  return (
    <>
      <NewAuditModal
        open={auditOpen}
        baseUrl={project.url}
        projectId={project.id}
        onClose={() => setAuditOpen(false)}
      />

      {sessionOpen && (
        <SessionCaptureModal
          open
          websiteId={project.id}
          url={project.url}
          onClose={() => setSessionOpen(false)}
        />
      )}

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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/websites')}
            className="self-start -ml-3 text-[13.5px] font-medium text-ld-text-3 hover:bg-transparent hover:text-ld-accent"
          >
            <ArrowLeft className="w-[15px] h-[15px] shrink-0" />
            My Websites
          </Button>

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
              const band = scoreBand(s);
              const cls = band === 'good'
                ? 'text-ld-accent-2 border-ld-accent-line bg-ld-accent-soft [data-theme=light]_:text-ld-accent'
                : band === 'warn'
                ? 'text-ld-amber border-ld-amber-line bg-ld-amber-soft'
                : 'text-ld-rose border-ld-rose-line bg-ld-rose-soft';
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

            {/* Login session — capture or refresh the cookies used for authenticated
                audits. An expired session says so: it is the state that needs an action,
                and reading "saved" beside a login warning is what made it invisible. */}
            <Button variant="outline" onClick={() => setSessionOpen(true)}>
              {session === 'active'
                ? <><ShieldCheck className="w-[15px] h-[15px] text-ld-accent" /> Session saved</>
                : session === 'expired'
                ? <><ShieldAlert className="w-[15px] h-[15px] text-ld-rose" /> Session expired</>
                : <><Lock className="w-[15px] h-[15px]" /> Set up login</>}
            </Button>

            {/* New Audit */}
            <Button onClick={() => setAuditOpen(true)}>
              <Plus /> New Audit
            </Button>
          </div>
        </div>

        {/* Last audit was redirected to a login screen — the scores below describe that
            screen, not the page that was asked for. */}
        {website?.requiresLogin && (
          <div className="flex items-start gap-[12px] px-[16px] py-[13px] rounded-[13px] border border-ld-amber-line bg-ld-amber-wash">
            <ShieldAlert className="w-[17px] h-[17px] text-ld-amber shrink-0 mt-[1px]" />
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-semibold text-ld-text">This site requires login</p>
              <p className="text-[12.5px] text-ld-text-2 mt-[3px] leading-[1.5]">
                An audit of{' '}
                <span className="font-mono text-ld-text-3">{website.requiresLogin.url}</span>{' '}
                was redirected to{' '}
                <span className="font-mono text-ld-text-3">{website.requiresLogin.loginUrl}</span>
                {session === 'expired'
                  ? ' — the saved session has stopped working.'
                  : ' — capture a login session to audit the real page.'}
              </p>
            </div>
            <Button variant="outline" size="md" className="shrink-0" onClick={() => setSessionOpen(true)}>
              <Lock className="w-[14px] h-[14px]" />
              {session === 'expired' ? 'Refresh session' : 'Set up login'}
            </Button>
          </div>
        )}
        </div>{/* end header section */}

        {/* ── Summary strip ─────────────────────────────── */}
        <div className="grid grid-cols-1 min-[680px]:grid-cols-2 min-[920px]:grid-cols-4 gap-[14px]">
          <StatCard label="Total Audits"  value={stats.totalAudits}   icon={<BarChart3 className="w-5 h-5" />} />
          <StatCard label="Unique Routes" value={stats.uniqueRoutes}  icon={<Route     className="w-5 h-5" />} />
          <StatCard label="Avg Score"     value={stats.totalAudits ? stats.avgPerformance : '—'} icon={<Activity className="w-5 h-5" />} />
          <StatCard label="Last Audit"    value={timeAgo(stats.lastAuditAt)} icon={<Clock className="w-5 h-5" />} compact />
        </div>

        {/* ── Tabs ──────────────────────────────────────────
             Lab runs and field data answer different questions — "what did our test
             measure" versus "what did real visitors get" — and stacking them made the
             page long enough that the RUM panel was rarely scrolled to at all. */}
        <div className="flex flex-col gap-[26px] -mt-[18px]">
          <TabBar
            tabs={[
              { key: 'audits', label: 'Audits',     icon: <BarChart3 className="w-[16px] h-[16px]" />, badge: stats.totalAudits || undefined },
              { key: 'field',  label: 'Field data', icon: <Activity  className="w-[16px] h-[16px]" /> },
            ]}
            active={tab}
            onChange={setTab}
            ariaLabel="Project view"
            className="self-start"
          />

        {tab === 'field' ? (
          <RumPanel websiteId={project.id} lab={latestLab} />
        ) : (
        <>
        {/* Empty state */}
        {groups.length === 0 && (
          <StatePanel
            icon={<Activity className="w-6 h-6" />}
            title="No audits yet"
            description="Run your first audit to start tracking performance across routes"
            action={
              <Button onClick={() => setAuditOpen(true)}>
                <Plus /> New Audit
              </Button>
            }
          />
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

        </>
        )}
        </div>

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
