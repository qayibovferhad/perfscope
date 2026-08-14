import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3, Clock, ExternalLink, Globe, Loader2, Moon, Route, Timer,
} from 'lucide-react';
import { useScheduledRuns, fetchHistoryResult } from '@/entities/history';
import type { ProjectAuditEntry } from '@/entities/history';
import { useAnalysisStore } from '@/features/analyzer';
import { RouteGroupCard } from '@/features/projects';
import { timeAgo } from '@/features/projects';
import { scoreBand } from '@/entities/analysis';
import { getHostname } from '@/entities/website';
import { Button } from '@/shared/ui/button';
import { StatCard } from '@/shared/ui/stat-card';
import { QueryErrorPanel, StatePanel } from '@/shared/ui/state-panel';

/** The badge the project header carries, so a site reads the same on both pages. */
function AvgBadge({ score }: { score: number }) {
  const band = scoreBand(score);
  const cls = band === 'good'
    ? 'text-ld-accent-2 border-ld-accent-line bg-ld-accent-soft'
    : band === 'warn'
    ? 'text-ld-amber border-ld-amber-line bg-ld-amber-soft'
    : 'text-ld-rose border-ld-rose-line bg-ld-rose-soft';

  return (
    <span className={`inline-flex items-center gap-[8px] text-[13px] font-semibold px-[14px] py-[8px] rounded-full border ${cls}`}>
      <b className="font-mono font-bold">{score}</b>
      Avg performance
    </span>
  );
}

/**
 * Everything the automation ran, kept out of the audit lists.
 *
 * Laid out as the project page repeated once per site — same header, same stat strip, same
 * expandable route cards with the full metrics table — because it shows the same thing:
 * a site's audits grouped by route. The difference is only which runs are in it.
 */
export function ScheduledPage() {
  const { data: sites = [], isLoading, isError, refetch } = useScheduledRuns();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const navigate  = useNavigate();
  const setResult = useAnalysisStore(s => s.setResult);

  async function openReport(entry: ProjectAuditEntry) {
    setLoadingId(entry.id);
    try {
      const result = await fetchHistoryResult(entry.id);
      setResult(result, entry.url);
      navigate('/app');
    } catch {
      // The full report is dropped for failed runs — the row simply stays put.
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="px-[clamp(22px,4vw,48px)] pt-[30px] pb-[80px] w-[min(1080px,100%)] mx-auto flex flex-col gap-[44px]">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div>
        <p className="font-mono text-[12px] tracking-[.16em] uppercase text-ld-accent font-semibold">
          Automation
        </p>
        <h1 className="text-[clamp(24px,3.2vw,32px)] font-extrabold tracking-[-0.03em] mt-2 text-ld-text">
          Scheduled reports
        </h1>
        <p className="text-[14.5px] text-ld-text-2 mt-[6px]">
          Every run the timetable made, by site and route. Each is the median of three
          measurements, so a change here is the page and not the noise.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-28">
          <Loader2 className="w-6 h-6 animate-spin text-ld-accent" />
        </div>
      )}

      {!isLoading && isError && (
        <QueryErrorPanel what="your scheduled runs" onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && sites.length === 0 && (
        <StatePanel
          icon={<Moon className="w-7 h-7" />}
          title="No scheduled runs yet"
          description="Turn automation on for a site and its routes are audited on the timetable you set. Results land here — the audit history stays what you ran yourself."
          action={<Button asChild><Link to="/automation">Set up automation</Link></Button>}
        />
      )}

      {/* ── One site, one report ─────────────────────────────────────── */}
      {sites.map(site => (
        <section key={site.project.id || site.project.url} className="flex flex-col gap-[22px]">

          <div className="flex items-center gap-[16px] flex-wrap">
            <span className="w-[54px] h-[54px] rounded-[15px] shrink-0 grid place-items-center bg-ld-surface-2 border border-ld-border text-ld-accent">
              <Globe className="w-[26px] h-[26px]" />
            </span>

            <div className="flex-1 min-w-[200px]">
              <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-ld-text leading-none">
                {site.project.name}
              </h2>
              <span className="inline-flex items-center gap-[7px] font-mono text-[13.5px] text-ld-text-3 mt-[5px]">
                {getHostname(site.project.url, site.project.url)}
                <a
                  href={site.project.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex text-ld-text-3 transition-colors duration-200 hover:text-ld-accent"
                  aria-label="Open site"
                >
                  <ExternalLink className="w-[14px] h-[14px]" />
                </a>
              </span>
            </div>

            <div className="flex items-center gap-[11px] flex-wrap">
              {site.stats.totalAudits > 0 && <AvgBadge score={site.stats.avgPerformance} />}
              {/* The project page holds everything about this site — including the audits
                  the user ran themselves, which this page deliberately leaves out. */}
              {site.project.id && (
                <Button variant="outline" asChild>
                  <Link to={`/projects/${site.project.id}`}>Open project</Link>
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 min-[680px]:grid-cols-2 min-[920px]:grid-cols-4 gap-[14px]">
            <StatCard label="Scheduled Runs" value={site.stats.totalAudits}  icon={<Timer     className="w-5 h-5" />} />
            <StatCard label="Routes"         value={site.stats.uniqueRoutes} icon={<Route     className="w-5 h-5" />} />
            <StatCard label="Avg Score"      value={site.stats.avgPerformance} icon={<BarChart3 className="w-5 h-5" />} />
            <StatCard
              label="Last Run"
              value={site.stats.lastAuditAt ? timeAgo(site.stats.lastAuditAt) : '—'}
              icon={<Clock className="w-5 h-5" />}
            />
          </div>

          <div className="flex flex-col gap-[14px]">
            {site.groups.map((group, i) => (
              <RouteGroupCard
                key={group.routePath}
                group={group}
                projectId={site.project.id}
                compareMode={false}
                selectedIds={new Set<string>()}
                onToggleSelect={() => {}}
                onOpen={entry => void openReport(entry)}
                loadingId={loadingId}
                // The first route opens on arrival: a page of collapsed rows makes the
                // reader click before it shows anything at all.
                initialOpen={i === 0}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
