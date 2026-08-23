import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Activity, Check, X } from 'lucide-react';
import { useRunningAuditsStore } from '@/entities/analysis';
import { getHostname } from '@/entities/website';
import { formatElapsed } from '@/entities/analysis';
import { cn } from '@/shared/lib/utils';

/** Rounded up, so a bar at 99% for twenty seconds does not read as finished. */
const pct = (n: number) => Math.min(99, Math.max(2, Math.round(n)));

/** A ticking clock, because a run's whole question is "how much longer". */
function useElapsed(since: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now - since;
}

/**
 * What is still running, in the shell, on every page.
 *
 * An audit takes tens of seconds and people do not sit and watch it: they start one and go
 * look at something else. Until now the run existed only on the page that started it — and
 * that page, once left, gave no sign it had ever been running. `adoptRunning` was already
 * there to re-attach to it; nothing ever told anyone there was something to re-attach to.
 *
 * Two renderings of one store. The sidebar gets the full row with a progress bar; the mobile
 * topbar, where there is no room, gets a spinner and a count.
 */
export function RunningAudits({ variant = 'full', onNavigate }: {
  variant?: 'full' | 'compact';
  onNavigate?: () => void;
}) {
  const runs = useRunningAuditsStore(s => s.runs);
  const finished = useRunningAuditsStore(s => s.finished);
  const dismissFinished = useRunningAuditsStore(s => s.dismissFinished);
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  const first = runs[0];
  if (!first && finished.length === 0) return null;

  function open(returnTo: string) {
    onNavigate?.();
    navigate(returnTo);
  }

  if (variant === 'compact') {
    // The topbar has room for one glyph. A run in flight outranks a finished one — the
    // finished result is not going anywhere.
    if (!first) {
      return (
        <button
          type="button"
          onClick={() => open('/app')}
          aria-label={`${finished.length} finished ${finished.length === 1 ? 'audit' : 'audits'}`}
          className="relative w-[36px] h-[36px] grid place-items-center rounded-[11px] border border-ld-accent-line bg-ld-accent-soft text-ld-accent cursor-pointer"
        >
          <Check className="w-[17px] h-[17px]" />
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => open(first.returnTo)}
        aria-label={runs.length === 1 ? `1 audit running, ${pct(first.progress)}%` : `${runs.length} audits running`}
        className="relative w-[36px] h-[36px] grid place-items-center rounded-[11px] border border-ld-accent-line bg-ld-accent-soft text-ld-accent cursor-pointer"
      >
        <Activity className={cn('w-[17px] h-[17px]', !reduced && 'animate-pulse')} />
        {runs.length > 1 && (
          <span className="absolute -top-[3px] -right-[3px] min-w-[17px] h-[17px] px-[4px] rounded-full grid place-items-center
                           font-mono text-[10px] font-bold leading-none text-[var(--ld-grad-text)] bg-ld-accent border-2 border-ld-bg-2">
            {runs.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <AnimatePresence initial={false}>
      <motion.div
        layout={!reduced}
        initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        {/* Margin on both sides: the brand row above and the Add Website button below are
            both flush against it otherwise, and a tinted card touching a filled button
            reads as one control in two colours. */}
        <div className="mt-[10px] mb-[14px] rounded-[12px] border border-ld-accent-line bg-ld-accent-wash overflow-hidden">
          {runs.map(run => (
            <RunRow key={run.key} run={run} onOpen={() => open(run.returnTo)} />
          ))}
          {/* A result that landed while the reader was elsewhere waits here as well as in
              the toast: the toast is where they were looking, this is where they come back
              to. Dismissed by opening it, or by the ×. */}
          {finished.map(done => (
            <div key={done.key} className="flex items-stretch border-t border-ld-accent-line first:border-t-0">
              <button
                type="button"
                onClick={() => { dismissFinished(done.key); open('/app'); }}
                className="flex-1 min-w-0 text-left px-[12px] py-[10px] bg-transparent border-0 cursor-pointer hover:bg-ld-accent-soft transition-colors"
              >
                <span className="flex items-center gap-[7px]">
                  <Check className="w-[13px] h-[13px] text-ld-accent shrink-0" />
                  <span className="font-mono text-[11.5px] text-ld-text truncate flex-1" title={done.url}>
                    {getHostname(done.url)}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-ld-accent tabular-nums shrink-0">
                    {done.score}
                  </span>
                </span>
                <span className="block font-mono text-[10.5px] text-ld-text-3 mt-[2px]">
                  Finished · open the report
                </span>
              </button>
              <button
                type="button"
                onClick={() => dismissFinished(done.key)}
                aria-label="Dismiss finished audit"
                className="w-[30px] shrink-0 grid place-items-center bg-transparent border-0 cursor-pointer text-ld-text-3 hover:text-ld-text hover:bg-ld-accent-soft transition-colors"
              >
                <X className="w-[12px] h-[12px]" />
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function RunRow({ run, onOpen }: { run: { key: string; url: string; progress: number; message: string; startedAt: number }; onOpen: () => void }) {
  const elapsed = useElapsed(run.startedAt);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left px-[12px] py-[10px] bg-transparent border-0 cursor-pointer hover:bg-ld-accent-soft transition-colors"
    >
      <span className="flex items-center gap-[7px]">
        <Activity className="w-[13px] h-[13px] text-ld-accent shrink-0" />
        <span className="font-mono text-[11.5px] text-ld-text truncate flex-1" title={run.url}>
          {getHostname(run.url)}
        </span>
        <span className="font-mono text-[10.5px] text-ld-text-3 tabular-nums shrink-0">
          {formatElapsed(elapsed)}
        </span>
      </span>

      {/* The message is the server's own ("Measuring performance — run 2 of 3"), so the
          pill says the same thing the analyzer page would if it were open. */}
      <span className="block font-mono text-[10.5px] text-ld-text-3 truncate mt-[2px]">
        {run.message}
      </span>

      <span className="block h-[3px] rounded-full bg-ld-border mt-[7px] overflow-hidden">
        <span
          className="block h-full rounded-full bg-ld-accent transition-[width] duration-500 ease-out"
          style={{ width: `${pct(run.progress)}%` }}
        />
      </span>
    </button>
  );
}
