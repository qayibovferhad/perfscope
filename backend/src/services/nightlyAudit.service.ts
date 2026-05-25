import { Website } from '../models/Website.model.js';
import { HistoryModel } from '../models/History.model.js';
import { lighthouseService } from './lighthouse.service.js';
import { AiService } from './ai.service.js';
import { HistoryService } from './history.service.js';

// Milliseconds between each audit within a nightly run — avoids saturating the host.
const AUDIT_DELAY_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}

async function getRoutesForWebsite(websiteUrl: string): Promise<string[]> {
  const normalized = normalizeUrl(websiteUrl);
  const docs = await HistoryModel
    .find({ normalizedUrl: { $regex: `^${normalized}` } })
    .distinct('routePath')
    .lean();
  // Always include root; remove duplicates.
  const routes = Array.from(new Set(['/', ...docs])) as string[];
  return routes;
}

async function runSingleAudit(
  fullUrl: string,
  userId: string,
  projectId: string,
  sessionData?: { cookies: unknown[]; localStorage: Record<string, string> } | null,
): Promise<void> {
  try {
    console.log(`[NightlyAudit] Auditing ${fullUrl}`);

    const result = sessionData
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? await lighthouseService.analyzeWithInjectedSession(fullUrl, sessionData as any, () => {})
      : await lighthouseService.analyzeStreaming(fullUrl, () => {});

    if (AiService.isAvailable()) {
      const criticals = (result.resources?.requests ?? [])
        .filter((r) => r.isCritical)
        .slice(0, 6);

      const [insights, adviceMap] = await Promise.all([
        AiService.getInsights(result).catch(() => null),
        criticals.length > 0
          ? AiService.getResourceAdvice(criticals).catch(() => new Map<string, string>())
          : Promise.resolve(new Map<string, string>()),
      ]);

      if (insights) result.aiInsights = insights;
      if (adviceMap.size > 0 && result.resources) {
        for (const req of result.resources.requests) {
          const advice = adviceMap.get(req.url);
          if (advice) req.advice = advice;
        }
      }
    }

    await HistoryService.save(
      {
        id:        result.id,
        shortId:   result.id.slice(0, 7),
        url:       result.url,
        timestamp: result.timestamp,
        scores:    result.scores,
        metrics:   result.metrics,
      },
      userId,
      projectId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result as unknown as Record<string, any>,
    );

    console.log(`[NightlyAudit] Done — perf score: ${result.scores.performance}`);
  } catch (err) {
    console.error(`[NightlyAudit] Failed for ${fullUrl}:`, (err as Error).message);
  }
}

export const NightlyAuditService = {
  async runAllEnabled(): Promise<void> {
    console.log('[NightlyAudit] Starting nightly run…');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let websites: any[];
    try {
      websites = await Website.find({ 'automation.enabled': true }).lean();
    } catch (err) {
      console.error('[NightlyAudit] Failed to query websites:', (err as Error).message);
      return;
    }

    if (websites.length === 0) {
      console.log('[NightlyAudit] No websites with automation enabled — skipping.');
      return;
    }

    console.log(`[NightlyAudit] Processing ${websites.length} website(s).`);

    for (const website of websites) {
      const userId    = website.userId.toString();
      const projectId = website._id.toString();
      const baseUrl   = website.url.replace(/\/$/, '');
      const session   = website.session
        ? { cookies: website.session.cookies, localStorage: website.session.localStorage }
        : null;

      const routes = await getRoutesForWebsite(website.url);
      console.log(`[NightlyAudit] ${website.name || baseUrl} — ${routes.length} route(s): ${routes.join(', ')}`);

      for (const route of routes) {
        const fullUrl = route === '/' ? baseUrl : `${baseUrl}${route}`;
        await runSingleAudit(fullUrl, userId, projectId, session);
        if (routes.indexOf(route) < routes.length - 1) {
          await sleep(AUDIT_DELAY_MS);
        }
      }

      // Mark last run timestamp.
      await Website.updateOne(
        { _id: website._id },
        { 'automation.lastRunAt': new Date() },
      ).catch(() => {});
    }

    console.log('[NightlyAudit] Nightly run complete.');
  },

  // Exposed for manual trigger via API.
  async runForWebsite(websiteId: string, userId: string): Promise<void> {
    const website = await Website.findOne({ _id: websiteId, userId }).lean();
    if (!website) throw new Error('Website not found');

    const baseUrl = website.url.replace(/\/$/, '');
    const session = website.session
      ? { cookies: website.session.cookies, localStorage: website.session.localStorage }
      : null;
    const routes = await getRoutesForWebsite(website.url);

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
