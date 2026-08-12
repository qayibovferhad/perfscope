import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, Loader2, Moon, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { scoreVerdict } from '@perfscope/shared';
import { scoreBand } from '@/entities/analysis';
import { useScheduledRuns, fetchHistoryResult } from '@/entities/history';
import type { ProjectAuditEntry } from '@/entities/history';
import { useAnalysisStore } from '@/features/analyzer/model/analysisStore';
import { Panel, PanelHeader } from '@/shared/ui/panel';
import { QueryErrorPanel, StatePanel } from '@/shared/ui/state-panel';
import { Button } from '@/shared/ui/button';

const BAND_TONE = {
  good: 'text-ld-score-good',
  warn: 'text-ld-amber',
  poor: 'text-ld-rose',
} as const;

/** "Aug 12, 03:00" — the date is the point of this page, so it is never relative. */
function fmtRunDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Change against the run before it — the previous *scheduled* run of the same route, which
 * is the only fair comparison on a page of unattended runs. Arrowed only when it clears
 * the shared noise threshold; anything smaller is the measurement, not the page.
 */
function Delta({ entry, prev }: { entry: ProjectAuditEntry; prev: ProjectAuditEntry | undefined }) {
  if (!prev) {
    return <span className="font-mono text-[11.5px] text-ld-text-3 w-[64px] text-right">first run</span>;
  }

  const delta   = entry.scores.performance - prev.scores.performance;
  const verdict = scoreVerdict(entry.scores.performance, prev.scores.performance);

  if (verdict === 'stable') {
    return (
      <span className="inline-flex items-center justify-end gap-[4px] font-mono text-[11.5px] text-ld-text-3 w-[64px]">
        <Minus className="w-[12px] h-[12px]" />{delta === 0 ? '0' : delta > 0 ? `+${delta}` : delta}
      </span>
    );
  }

  const up = verdict === 'improved';
  return (
    <span className={`inline-flex items-center justify-end gap-[4px] font-mono text-[11.5px] font-semibold w-[64px] ${
      up ? 'text-ld-accent' : 'text-ld-rose'
    }`}>
      {up ? <ArrowUpRight className="w-[12px] h-[12px]" /> : <ArrowDownRight className="w-[12px] h-[12px]" />}
      {up ? `+${delta}` : delta}
    </span>
  );
}

/**
 * Everything the automation ran, kept out of the audit lists.
 *
 * A nightly timetable produces more runs in a week than a person does in a month, so the
 * history page and the dashboard's recent audits stay a record of what the user did, and
 * this page answers the other question: what has each route been doing unattended.
 */
export function ScheduledPage() {
  const { data: sites = [], isLoading, isError, refetch } = useScheduledRuns();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const navigate  = useNavigate();
  const setResult = useAnalysisStore(s => s.setResult);

  async function openInAnalyzer(entry: ProjectAuditEntry) {
    setOpeningId(entry.id);
    try {
      const result = await fetchHistoryResult(entry.id);
      setResult(result, entry.url);
      navigate('/app');
    } catch {
      // The full report is dropped for failed runs — the row simply stays put.
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div className="w-[min(1120px,100%)] mx-auto px-[clamp(22px,4vw,48px)] pt-[34px] pb-20">

      <div className="mb-[26px]">
        <p className="font-mono text-[12px] tracking-[.16em] uppercase text-ld-accent font-semibold">
          Automation
        </p>
        <h1 className="text-[clamp(26px,3.4vw,34px)] font-extrabold tracking-[-0.03em] mt-2 text-ld-text">
          Scheduled reports
        </h1>
        <p className="text-[14.5px] text-ld-text-2 mt-[6px]">
          Every run the timetable made, by site and route. Each is a median of three
          measurements, so a change here is the page, not the noise.
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

      <div className="flex flex-col gap-[18px]">
        {sites.map(site => (
          <Panel key={site.websiteId}>
            <PanelHeader
              icon={<CalendarClock />}
              title={site.name}
              meta={`${site.runs} run${site.runs === 1 ? '' : 's'} · last ${timeAgo(site.lastRunAt)}`}
            />

            {site.routes.map(route => (
              <div key={route.routePath} className="border-t border-ld-border first:border-t-0">
                <div className="flex items-center justify-between gap-3 px-[18px] py-[10px] bg-ld-surface-2">
                  <span className="font-mono text-[12.5px] font-semibold text-ld-text truncate">
                    {route.routePath}
                  </span>
                  <span className="font-mono text-[11px] text-ld-text-3 shrink-0">
                    {route.entries.length} run{route.entries.length === 1 ? '' : 's'}
                  </span>
                </div>

                <ul className="flex flex-col">
                  {route.entries.map((entry, i) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => void openInAnalyzer(entry)}
                        disabled={openingId === entry.id}
                        className="w-full flex items-center gap-[14px] px-[18px] py-[11px] text-left
                                   border-t border-ld-border transition-colors duration-150
                                   hover:bg-ld-surface-hover disabled:opacity-60"
                      >
                        <span className={`font-mono text-[17px] font-semibold tabular-nums w-[30px] shrink-0 ${
                          BAND_TONE[scoreBand(entry.scores.performance)]
                        }`}>
                          {entry.scores.performance}
                        </span>

                        <span className="font-mono text-[12.5px] text-ld-text-2 flex-1 min-w-0 truncate">
                          {fmtRunDate(entry.timestamp)}
                        </span>

                        {/* Entries arrive newest-first, so the next one is the run before. */}
                        <Delta entry={entry} prev={route.entries[i + 1]} />

                        {openingId === entry.id && (
                          <Loader2 className="w-[13px] h-[13px] animate-spin text-ld-accent shrink-0" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Panel>
        ))}
      </div>
    </div>
  );
}
