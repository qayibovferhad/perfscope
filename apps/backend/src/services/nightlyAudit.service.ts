import type { Types } from 'mongoose';
import { routesDueAt } from '@perfscope/shared';
import { Website } from '../models/Website.model.js';
import { lighthouseService } from './lighthouse.service.js';
import { enrichWithAi, persistAudit } from './auditPipeline.js';

// Milliseconds between each audit within a nightly run — avoids saturating the host.
const AUDIT_DELAY_MS = 15_000;

/**
 * Every unattended run is a median of this many, login-walled pages included.
 *
 * These runs are the only measurement of a page nobody is watching: they feed the trend,
 * the budgets and the regression alerts, and a single sample swings by around ten points
 * on its own. Waking someone for a swing that was never there is worse than the extra
 * minutes — and the queue keeps them behind anyone waiting on a page.
 */
const SCHEDULED_RUNS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The captured-session fields an audit needs, as they come off a lean Website document. */
interface SessionSource {
  cookies: unknown[];
  localStorage: Record<string, string>;
}

async function runSingleAudit(
  fullUrl: string,
  userId: string,
  projectId: string,
  sessionData?: { cookies: unknown[]; localStorage: Record<string, string> } | null,
): Promise<void> {
  try {
    console.log(`[NightlyAudit] Auditing ${fullUrl}`);

    // Unattended runs feed trends, budgets and regression detection, so they pay
    // the extra minutes for a median instead of trusting one noisy sample. They
    // also yield to anyone waiting on a page.
    const result = sessionData
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? await lighthouseService.analyzeWithInjectedSession(fullUrl, sessionData as any, () => {}, { priority: 'background', runs: SCHEDULED_RUNS })
      : await lighthouseService.analyzeStreaming(fullUrl, () => {}, { priority: 'background', runs: SCHEDULED_RUNS });

    await enrichWithAi(result);
    await persistAudit(result, userId, projectId, 'scheduled');

    console.log(`[NightlyAudit] Done — perf score: ${result.scores.performance}`);
  } catch (err) {
    console.error(`[NightlyAudit] Failed for ${fullUrl}:`, (err as Error).message);
  }
}

/**
 * Audit `routes` of one site in order, pausing between them, then stamp the run time.
 *
 * Shared by the timetable and the manual "Run now" button so the two cannot disagree
 * about what auditing a site means — they had drifted once already, the manual copy
 * pausing on `routes.indexOf(route)` rather than the loop index, which skips the pause
 * whenever a route is listed twice.
 */
async function auditRoutes(
  website: { _id: Types.ObjectId; url: string; session?: SessionSource | null },
  routes: string[],
  userId: string,
): Promise<void> {
  const projectId = website._id.toString();
  const baseUrl   = website.url.replace(/\/$/, '');
  const session   = website.session
    ? { cookies: website.session.cookies, localStorage: website.session.localStorage }
    : null;

  for (let i = 0; i < routes.length; i++) {
    const route   = routes[i]!;
    const fullUrl = route === '/' ? baseUrl : `${baseUrl}${route}`;
    await runSingleAudit(fullUrl, userId, projectId, session);
    if (i < routes.length - 1) await sleep(AUDIT_DELAY_MS);
  }

  await Website.updateOne(
    { _id: website._id },
    { 'automation.lastRunAt': new Date() },
  ).catch(() => {});
}

/** Sites whose timetable is on. Returns empty on a query failure — same outcome as none due. */
async function enabledWebsites() {
  try {
    return await Website.find({ 'automation.enabled': true }).lean();
  } catch (err) {
    console.error('[NightlyAudit] Failed to query websites:', (err as Error).message);
    return [];
  }
}

/**
 * Slots in flight, keyed by `${websiteId}:${hhmm}`.
 *
 * The cron ticks every minute while a slot's routes take minutes to audit (each is a
 * 3-run median). Without this, a tick that arrives while the previous one is still
 * working — a clock adjustment, a slow queue, a restart — starts the same routes again.
 * A single time per site made that unlikely; a timetable makes it routine.
 */
const inFlight = new Set<string>();

export const NightlyAuditService = {
  /**
   * @param scheduleTime 'HH:MM' from the cron tick. Omitted means "run everything now",
   *   which only the manual path uses.
   */
  async runAllEnabled(scheduleTime?: string): Promise<void> {
    const label    = scheduleTime ?? 'manual';
    const websites = await enabledWebsites();
    if (websites.length === 0) return;

    // Which routes each site owes this minute. Computed with the same helper the setup
    // modal previews, so the timetable the user was shown is the one that runs.
    const due = websites
      .map(website => ({
        website,
        routes: scheduleTime
          ? routesDueAt(website.automation, scheduleTime)
          : (website.automation?.routes ?? []),
      }))
      .filter(({ routes }) => routes.length > 0);

    if (due.length === 0) return;

    console.log(`[NightlyAudit] Starting run (${label}) — ${due.length} website(s) due.`);

    for (const { website, routes } of due) {
      const baseUrl = website.url.replace(/\/$/, '');
      const key     = `${website._id.toString()}:${label}`;

      if (inFlight.has(key)) {
        console.log(`[NightlyAudit] ${website.name || baseUrl} — ${label} still running, skipping this tick.`);
        continue;
      }
      inFlight.add(key);

      try {
        console.log(`[NightlyAudit] ${website.name || baseUrl} @ ${label} — ${routes.length} route(s): ${routes.join(', ')}`);
        await auditRoutes(website, routes, website.userId.toString());
      } finally {
        inFlight.delete(key);
      }
    }

    console.log(`[NightlyAudit] Run complete (${label}).`);
  },

  /**
   * Manual "Run now" from the UI. Deliberately ignores the timetable and audits every
   * route: the user pressed the button because they want the site checked, not because
   * they want to know what 14:00 would have done.
   */
  async runForWebsite(websiteId: string, userId: string): Promise<void> {
    const website = await Website.findOne({ _id: websiteId, userId }).lean();
    if (!website) throw new Error('Website not found');

    const routes: string[] = website.automation?.routes ?? [];
    if (routes.length === 0) throw new Error('No routes configured for this website');

    await auditRoutes(website, routes, userId);
  },
};
