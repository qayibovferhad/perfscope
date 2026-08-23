import { create } from 'zustand';
import { hmrSingleton } from '@/shared/lib/hmrSingleton';
import type { AnalysisProgress, AnalysisStage } from '@perfscope/shared';

/**
 * An audit that is still going, wherever it was started from.
 *
 * `analysisId` is null until the first progress event: the *server* mints it (so that
 * concurrent audits cannot read each other's progress), which means the client knows a run
 * exists a second or two before it knows its name. Until then the run is "unclaimed", and
 * the first id to arrive belongs to the oldest unclaimed run — the events are delivered in
 * the order the audits were queued.
 */
export interface RunningAudit {
  key:        string;
  url:        string;
  /** Server-assigned; null for the first moment of the run. */
  analysisId: string | null;
  startedAt:  number;
  progress:   number;
  stage:      AnalysisStage;
  message:    string;
  /** Where to send someone who wants to watch it — the page it belongs to. */
  returnTo:   string;
}

/**
 * A run older than this is presumed dead.
 *
 * The server aborts a Lighthouse pass at four minutes (`RUN_TIMEOUT_MS`) and a precise
 * audit is several of them, so this is generous. It exists for the one case events cannot
 * cover: a socket that went away takes the completion with it, and without a floor the
 * indicator would claim a run was in flight forever.
 */
const STALE_AFTER_MS = 12 * 60_000;

/**
 * An audit that has finished while the reader was somewhere else.
 *
 * Kept beside the running ones because the shell's list answers one question — "what has
 * my account been doing?" — and a run that finished thirty seconds ago is part of that
 * answer until someone has looked at it.
 */
export interface FinishedAudit {
  key:   string;
  url:   string;
  score: number;
  at:    number;
}

/** Past a few, this stops being a list of results and becomes a backlog. */
const MAX_FINISHED = 3;

interface RunningAuditsStore {
  runs: RunningAudit[];
  /** Finished while unwatched, newest first, waiting to be opened or dismissed. */
  finished: FinishedAudit[];
  /** Register a run that has just been asked for. Returns its local key. */
  begin: (url: string, returnTo: string) => string;
  /** Route a progress event to the run it belongs to. */
  applyProgress: (progress: AnalysisProgress) => void;
  /** A run finished or failed. An empty id means "whichever run never got one". */
  endByAnalysisId: (analysisId: string | undefined) => void;
  end: (key: string) => void;
  /** Record a run that finished while nobody was looking at it. */
  finish: (url: string, score: number) => void;
  dismissFinished: (key: string) => void;
}

let counter = 0;

/** The run an event belongs to: the one that owns the id, or the oldest that has none yet. */
function ownerOf(runs: RunningAudit[], analysisId: string | undefined): RunningAudit | undefined {
  if (analysisId) {
    const claimed = runs.find(r => r.analysisId === analysisId);
    if (claimed) return claimed;
  }
  return runs.find(r => r.analysisId === null);
}

const fresh = (runs: RunningAudit[]) => runs.filter(r => Date.now() - r.startedAt < STALE_AFTER_MS);

/** One store per tab — see `hmrSingleton`. Two copies of this is the pill reading one and
 *  the cancel clearing the other. */
export const useRunningAuditsStore = hmrSingleton('runningAudits', () => create<RunningAuditsStore>((set) => ({
  runs: [],
  finished: [],

  begin: (url, returnTo) => {
    const key = `run-${++counter}`;
    set((s) => ({
      // Pruned on every write rather than on a timer: there is no interval to leak, and a
      // stale entry only matters at a moment the list is being written or read anyway.
      runs: [
        ...fresh(s.runs),
        { key, url, analysisId: null, startedAt: Date.now(), progress: 0, stage: 'launching', message: 'Starting…', returnTo },
      ],
    }));
    return key;
  },

  applyProgress: (progress) => set((s) => {
    const owner = ownerOf(s.runs, progress.analysisId);
    if (!owner) return s;
    return {
      runs: fresh(s.runs).map(r => r.key === owner.key
        ? {
            ...r,
            analysisId: progress.analysisId || r.analysisId,
            progress:   progress.progress,
            stage:      progress.stage,
            message:    progress.message,
          }
        : r),
    };
  }),

  endByAnalysisId: (analysisId) => set((s) => {
    const owner = ownerOf(s.runs, analysisId);
    return owner ? { runs: s.runs.filter(r => r.key !== owner.key) } : s;
  }),

  end: (key) => set((s) => ({ runs: s.runs.filter(r => r.key !== key) })),

  finish: (url, score) => set((s) => ({
    finished: [{ key: `done-${++counter}`, url, score, at: Date.now() }, ...s.finished].slice(0, MAX_FINISHED),
  })),

  dismissFinished: (key) => set((s) => ({ finished: s.finished.filter(f => f.key !== key) })),
})));

// ─── Dev only ────────────────────────────────────────────────────────────────
// This module holds live state — a socket, a store, or the listeners that keep them in
// step. Vite's default hot update evaluates a *new copy* and leaves the old one running,
// so the tab ends up with two of everything: one set answering events, another rendering
// the screen. That is invisible until something like Stop stops working, and then it
// costs hours, because a fresh tab behaves perfectly and the reporter's does not.
//
// So changes here force a full reload instead. Slower to develop against, and honest.
if (import.meta.hot) import.meta.hot.accept(() => import.meta.hot?.invalidate());
