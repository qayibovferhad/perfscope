import { Globe, Link2, ShieldCheck, ShieldAlert, Clock, Zap, GitCompareArrows, ExternalLink, Trash2, ArrowRight } from 'lucide-react';
import { motion }          from 'framer-motion';
import { Link }            from 'react-router-dom';
import { getHostname }     from '@/entities/website';
import type { Website }    from '@/entities/website';
import type { SiteScoreInfo } from '@/features/websites/model/useWebsiteScores';
import { Button }          from '@/shared/ui/button';
import { ScoreRing }       from './ScoreRing';
import { SparkBars }       from './SparkBars';

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0)  return 'today';
  if (days === 1)  return 'yesterday';
  if (days < 30)   return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

interface Props {
  site:      Website;
  scoreInfo: SiteScoreInfo;
  isList:    boolean;
  onAnalyze: () => void;
  onCompare: () => void;
  onDelete:  () => void;
}

export function WebsiteCard({ site, scoreInfo, isList, onAnalyze, onCompare, onDelete }: Props) {
  const hostname   = getHostname(site.url);
  const detailPath = `/projects/${site._id}`;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative overflow-hidden rounded-[18px] border border-ld-border bg-ld-surface shadow-ld-shadow-card cursor-pointer
                  transition-[border-color,transform,box-shadow] duration-[280ms]
                  hover:border-ld-accent-line hover:-translate-y-[3px]
                  hover:shadow-[0_0_0_1px_var(--ld-accent-soft),_0_26px_56px_-32px_rgba(20,192,138,0.5)]
                  ${isList ? 'flex items-center gap-[18px] px-5 py-[14px]' : 'p-5'}`}
    >
      {/* Gradient accent line — top in grid, left in list */}
      <div className={`absolute pointer-events-none bg-ld-grad transition-transform duration-[400ms] ease-in-out
                       ${isList
                         ? 'top-0 bottom-0 left-0 w-[3px] scale-y-0 group-hover:scale-y-100 origin-top'
                         : 'top-0 left-0 right-0 h-[3px] scale-x-0 group-hover:scale-x-100 origin-left'}`}
      />

      {/* Whole-card navigation target. Sits beneath the action buttons, which are
          lifted with z-10 so they keep their own click handlers. */}
      <Link
        to={detailPath}
        aria-label={`Open ${site.name || hostname} details`}
        className="absolute inset-0 rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ld-accent-line"
      />

      {/* ── Top ──────────────────────────────────────────────────────── */}
      <div className={`flex gap-[13px] ${isList ? 'flex-1 min-w-0 items-center' : 'items-start'}`}>
        {/* Leading tile — swaps to an arrow on hover so it reads as "opens the detail page" */}
        <div className="w-[44px] h-[44px] rounded-[12px] shrink-0 grid place-items-center border transition-colors duration-200
                        bg-ld-surface-2 border-ld-border text-ld-accent
                        group-hover:bg-ld-grad group-hover:border-transparent group-hover:text-white">
          <Globe className="w-[21px] h-[21px] col-start-1 row-start-1 transition-all duration-200 group-hover:opacity-0 group-hover:scale-75" />
          <ArrowRight className="w-[21px] h-[21px] col-start-1 row-start-1 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[17px] font-bold tracking-[-0.01em] text-ld-text truncate transition-colors duration-200 group-hover:text-ld-accent">
            {site.name || hostname}
          </h3>
          <span className="flex items-center gap-[6px] font-mono text-[12.5px] text-ld-text-3 mt-[3px]">
            <Link2 className="w-3 h-3 shrink-0" />
            <span className="truncate">{hostname}</span>
          </span>
        </div>
        <ScoreRing score={scoreInfo.avgScore} size={isList ? 44 : 58} />
      </div>

      {/* ── Meta — hidden in list mode ────────────────────────────── */}
      {!isList && (
        <div className="flex flex-wrap items-center gap-[10px] mt-4 w-full min-w-0">
          {site.session && (
            <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold px-[10px] py-[5px] rounded-full border border-ld-accent-line bg-ld-accent-soft text-ld-accent-2">
              <ShieldCheck className="w-[13px] h-[13px]" /> Saved
            </span>
          )}
          {/* The last audit landed on a login screen — the scores are for that screen. */}
          {site.requiresLogin && (
            <span
              className="inline-flex items-center gap-[6px] text-[12px] font-semibold px-[10px] py-[5px] rounded-full border border-[rgba(230,162,60,0.3)] bg-[rgba(230,162,60,0.1)] text-ld-amber"
              title={`Audit was redirected to ${site.requiresLogin.loginUrl}`}
            >
              <ShieldAlert className="w-[13px] h-[13px]" /> Login required
            </span>
          )}
          {scoreInfo.lastAuditedAt ? (
            <span className="inline-flex items-center gap-[6px] font-mono text-[12px] font-medium px-[10px] py-[5px] rounded-full border border-ld-border text-ld-text-2">
              <Clock className="w-[13px] h-[13px]" /> {timeAgo(scoreInfo.lastAuditedAt)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold px-[10px] py-[5px] rounded-full border border-ld-border text-ld-text-3">
              No audit
            </span>
          )}
          <SparkBars scores={scoreInfo.recentScores} />
        </div>
      )}

      {/* ── Actions — z-10 keeps them clickable above the full-card link ─ */}
      <div className={`relative z-10 flex gap-2 ${isList ? 'shrink-0' : 'mt-[18px] pt-4 border-t border-ld-border'}`}>
        <Button
          size="md"
          onClick={onAnalyze}
          className={isList ? '' : 'flex-1'}
        >
          <Zap /> Analyze
        </Button>

        <Button variant="outline" size="md" onClick={onCompare}>
          <GitCompareArrows /> Compare
        </Button>

        <Button variant="outline" size="icon" asChild onClick={e => e.stopPropagation()}>
          <a href={site.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
          </a>
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onDelete}
          className="hover:text-ld-rose"
        >
          <Trash2 />
        </Button>
      </div>
    </motion.article>
  );
}
