import { Globe, Link2, ShieldCheck, ShieldAlert, Clock, Zap, GitCompareArrows, ExternalLink, Trash2, ArrowRight, Target } from 'lucide-react';
import { motion }          from 'framer-motion';
import { Link }            from 'react-router-dom';
import { cn }              from '@/shared/lib/utils';
import { getHostname, sessionState } from '@/entities/website';
import type { Website }    from '@/entities/website';
import type { SiteScoreInfo } from '@/features/websites';
import { Button }          from '@/shared/ui/button';
import { ScoreRing }       from '@/entities/analysis';
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

/** Targets a lab audit can judge. INP is field-only, so it never counts as met or missed. */
const LAB_TARGETS = ['performance', 'lcp', 'tbt', 'cls'] as const;

export function WebsiteCard({ site, scoreInfo, isList, onAnalyze, onCompare, onDelete }: Props) {
  const hostname   = getHostname(site.url);
  const detailPath = `/projects/${site._id}`;
  const session    = sessionState(site);

  // `met` is null until an audit has actually judged them — targets that nothing has
  // measured yet are set, not passing, and saying "3 / 3 met" for a site that has never
  // been audited would be a lie the card tells confidently.
  const targets = (() => {
    const set = LAB_TARGETS.filter(m => site.budgets?.[m] != null).length;
    if (!set) return { set: 0, missed: 0, met: null as number | null };
    if (!scoreInfo.lastAuditedAt) return { set, missed: 0, met: null as number | null };
    const missed = site.lastBudgetBreach?.failures.length ?? 0;
    return { set, missed, met: Math.max(0, set - missed) };
  })();

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
          {/* h2, not h3: the page title is the h1 and there is nothing between it and a
              card, so h3 skipped a level — which is what a screen reader's heading list
              reads as a missing section. */}
          <h2 className="text-[17px] font-bold tracking-[-0.01em] text-ld-text truncate transition-colors duration-200 group-hover:text-ld-accent">
            {site.name || hostname}
          </h2>
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
          {/* A saved session that no longer works must not read as healthy — the
              expired state replaces the badge rather than sitting beside it. */}
          {session === 'active' && (
            <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold px-[10px] py-[5px] rounded-full border border-ld-accent-line bg-ld-accent-soft text-ld-accent-2">
              <ShieldCheck className="w-[13px] h-[13px]" /> Saved
            </span>
          )}
          {session === 'expired' && (
            <span
              className="inline-flex items-center gap-[6px] text-[12px] font-semibold px-[10px] py-[5px] rounded-full border border-ld-rose-line bg-ld-rose-wash text-ld-rose"
              title={`The saved session no longer works — a run was redirected to ${site.requiresLogin?.loginUrl}`}
            >
              <ShieldAlert className="w-[13px] h-[13px]" /> Session expired
            </span>
          )}
          {/* Targets at a glance.

              The badge used to say only what had gone wrong — "2 targets missed" — so a
              site that met four out of five looked identical to one that met none, and
              the only way to see progress was to open the site. Both numbers, from data
              already on the card: the targets set, and the ones the last audit missed. */}
          {targets.set > 0 && (
            <Link
              to={`${detailPath}?tab=targets`}
              onClick={e => e.stopPropagation()}
              className={cn(
                'relative z-10 inline-flex items-center gap-[6px] text-[12px] font-semibold px-[10px] py-[5px] rounded-full border transition-colors',
                targets.missed > 0
                  ? 'border-ld-rose-line bg-ld-rose-wash text-ld-rose hover:bg-ld-rose-soft'
                  : targets.met === null
                  ? 'border-ld-border text-ld-text-3 hover:bg-ld-surface-hover'
                  : 'border-ld-accent-line bg-ld-accent-soft text-[var(--ld-accent-2)] hover:bg-ld-surface-hover',
              )}
            >
              <Target className="w-[13px] h-[13px]" />
              {targets.met === null
                ? `${targets.set} target${targets.set === 1 ? '' : 's'} set`
                : `${targets.met} / ${targets.set} targets met`}
            </Link>
          )}

          {/* Only when there is no session at all — with one, "expired" above says it. */}
          {site.requiresLogin && session === 'none' && (
            <span
              className="inline-flex items-center gap-[6px] text-[12px] font-semibold px-[10px] py-[5px] rounded-full border border-ld-amber-line bg-ld-amber-soft text-ld-amber"
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
        {/* Analyze used to be flex-1, which stretched it to more than twice the width of
            Compare beside it — the row read as one enormous button with three offcuts
            rather than a primary action among its alternatives. Natural widths, with the
            two icon actions pushed to the far end. */}
        <Button size="md" onClick={onAnalyze}>
          <Zap /> Analyze
        </Button>

        <Button variant="outline" size="md" onClick={onCompare}>
          <GitCompareArrows /> Compare
        </Button>

        <Button variant="outline" size="icon" asChild onClick={e => e.stopPropagation()}
                className={isList ? '' : 'ml-auto'}>
          {/* An icon is not a name. Both of these announced as "link" and "button" and
              nothing else — the one thing a screen reader user cannot work around. */}
          <a href={site.url} target="_blank" rel="noopener noreferrer"
             aria-label={`Open ${hostname} in a new tab`}>
            <ExternalLink />
          </a>
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onDelete}
          aria-label={`Delete ${site.name || hostname}`}
          className="hover:text-ld-rose"
        >
          <Trash2 />
        </Button>
      </div>
    </motion.article>
  );
}
