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
    const label = scheduleTime ?? 'manual';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let websites: any[];
    try {
      websites = await Website.find({ 'automation.enabled': true }).lean();
    } catch (err) {
      console.error('[NightlyAudit] Failed to query websites:', (err as Error).message);
      return;
    }

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
      const userId    = website.userId.toString();
      const projectId = website._id.toString();
      const baseUrl   = website.url.replace(/\/$/, '');
      const session   = website.session
        ? { cookies: website.session.cookies, localStorage: website.session.localStorage }
        : null;

      const key = `${projectId}:${label}`;
      if (inFlight.has(key)) {
        console.log(`[NightlyAudit] ${website.name || baseUrl} — ${label} still running, skipping this tick.`);
        continue;
      }
      inFlight.add(key);

      try {
        console.log(`[NightlyAudit] ${website.name || baseUrl} @ ${label} — ${routes.length} route(s): ${routes.join(', ')}`);

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

    const baseUrl = website.url.replace(/\/$/, '');
    const session = website.session
      ? { cookies: website.session.cookies, localStorage: website.session.localStorage }
      : null;
    const routes: string[] = website.automation?.routes ?? [];
    if (routes.length === 0) throw new Error('No routes configured for this website');

    for (const route of routes) {
      const fullUrl = route === '/' ? baseUrl : `${baseUrl}${route}`;
      await runSingleAudit(fullUrl, userId, website._id.toString(), session);
      if (routes.indexOf(route) < routes.length - 1) await sleep(AUDIT_DELAY_MS);
    }

    await Website.updateOne(
      { _id: website._id },
      { 'automation.lastRunAt': new Date() },
    ).catch(() => {});
  },
};
