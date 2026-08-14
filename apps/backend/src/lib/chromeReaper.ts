/**
 * Chrome instances outlive us far too easily: puppeteer's own cleanup only runs
 * on a graceful exit, so a killed dev server, a terminated worker thread or a
 * crash leaves a full browser process behind. They are invisible (headless),
 * they never exit on their own, and after a few days of development they eat
 * gigabytes — at which point new audits start failing with CDP timeouts because
 * the machine has no CPU left to answer with.
 *
 * So: every browser this process spawns is registered here, and killed when the
 * process goes down for any reason.
 */

import { readdirSync, readFileSync } from 'node:fs';

/** How often to look for browsers that lost their owner. */
const ORPHAN_SWEEP_MS = 10 * 60_000;

const live = new Set<number>();

/** Register a spawned browser. Returns an unregister fn to call once it is closed. */
export function trackChrome(pid: number | undefined): () => void {
  if (!pid) return () => {};
  live.add(pid);
  return () => live.delete(pid);
}

/** SIGKILL a browser we own, e.g. after terminating the worker thread that held it. */
export function killChrome(pid: number | undefined): void {
  if (!pid) return;
  try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  live.delete(pid);
}

function reapAll(): void {
  for (const pid of live) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  }
  live.clear();
}

/**
 * Kill browsers nobody owns any more.
 *
 * Signal handlers cover a graceful shutdown, but `kill -9` — how dev servers
 * usually die — runs nothing at all, so those browsers survive as orphans and
 * accumulate for weeks. On Linux an orphan is reparented away from its node
 * parent, which makes it identifiable: a puppeteer-cache Chrome whose parent is
 * not a Node process is driven by nobody.
 *
 * Deliberately narrow: only Chrome under puppeteer's own cache directory (never
 * the user's installed browser) and only top-level processes (renderers and GPU
 * helpers die with their parent).
 */
export function reapOrphanedChrome(): number {
  let killed = 0;

  for (const entry of readdirSync('/proc')) {
    const pid = Number(entry);
    if (!Number.isInteger(pid)) continue;

    try {
      const cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf8');
      if (!cmdline.includes('.cache/puppeteer/chrome')) continue;
      if (cmdline.includes('--type=')) continue; // helper process, dies with its parent

      // /proc/<pid>/stat: field 4 is ppid, but comm (field 2) may contain spaces,
      // so parse after the closing parenthesis.
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
      if (!Number.isInteger(ppid) || ppid <= 0) continue;

      const parent = readFileSync(`/proc/${ppid}/comm`, 'utf8').trim();
      if (parent === 'node') continue; // a live Node process is driving it

      process.kill(pid, 'SIGKILL');
      killed++;
    } catch { /* process vanished or is not ours to read */ }
  }

  if (killed > 0) console.warn(`[Chrome] Reaped ${killed} orphaned browser(s) left by a previous run`);
  return killed;
}

let installed = false;

/** Wire the process-exit reaper once, from app startup. */
export function installChromeReaper(): void {
  if (installed) return;
  installed = true;

  if (process.platform === 'linux') {
    // A SIGKILLed predecessor could not clean up after itself; do it for it.
    reapOrphanedChrome();
    // Orphans are also created *while* we run (a crashed worker, a browser that
    // ignored close) and reparenting is not instant, so one boot-time pass cannot
    // be the only net. This scan is a cheap /proc walk; unref'd so it never keeps
    // the process alive on its own.
    setInterval(reapOrphanedChrome, ORPHAN_SWEEP_MS).unref();
  }

  process.on('exit', reapAll);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => {
      reapAll();
      // Re-raise with the default handler so exit codes stay honest.
      process.exit(signal === 'SIGINT' ? 130 : 143);
    });
  }
  process.on('uncaughtException', (err) => {
    console.error('[Chrome] Reaping browsers after uncaught exception:', err);
    reapAll();
    process.exit(1);
  });
}

