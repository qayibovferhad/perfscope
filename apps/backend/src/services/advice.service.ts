import type { AiAdvice } from '@perfscope/shared';
import { AiService } from './ai.service.js';
import { getOverview } from './overview.service.js';
import { findWebsiteByHost } from './websiteLookup.js';
import { HistoryModel } from '../models/History.model.js';
import { HAS_RESULT_FILTER } from '../lib/history.js';
import { fmtMs } from '@perfscope/shared';

/**
 * What the advisor panel is looking at.
 *
 * Kept to two, not one per route: the advice a user needs on the websites list and on the
 * dashboard is the same advice, and inventing a prompt per page would mean five prompts to
 * keep in step for no extra insight. Everything account-wide is `overview`; anything about
 * one page is `site`.
 */
export type AdviceScope = 'overview' | 'site';

/** Enough context to be specific, short enough to stay cheap. */
const SITE_LIMIT   = 6;
const HISTORY_RUNS = 6;

/**
 * The lines handed to the model, and the sentence describing what the user is looking at.
 *
 * Assembled here rather than in the route so the prompt's input is one function: the
 * advice is only as good as this, and it is the thing to change when the advice is vague.
 */
async function buildContext(
  userId: string, scope: AdviceScope, target?: string,
): Promise<{ scope: string; lines: string[] }> {
  if (scope === 'site' && target) return buildSiteContext(userId, target);
  return buildOverviewContext(userId);
}

async function buildOverviewContext(userId: string): Promise<{ scope: string; lines: string[] }> {
  const o = await getOverview(userId);
  const lines: string[] = [
    `Sites tracked: ${o.totals.sites}, audited: ${o.totals.audited}, average score: ${o.totals.avgScore || 'none yet'}`,
    `Audits in the last 7 days: ${o.totals.audits7d}, sites needing attention: ${o.totals.needsAttention}`,
  ];

  if (o.attention.length) {
    lines.push('Sites needing attention:');
    for (const a of o.attention.slice(0, SITE_LIMIT)) {
      lines.push(`- ${a.url}: ${a.reason}`);
    }
  }

  if (o.incidents.length) {
    lines.push(`Open incidents (${o.incidents.length}):`);
    for (const i of o.incidents.slice(0, SITE_LIMIT)) {
      lines.push(`- ${i.url} ${i.event}: ${i.lines.join('; ')}`);
    }
  }

  if (o.recentAudits.length) {
    lines.push('Most recent audits:');
    for (const a of o.recentAudits.slice(0, SITE_LIMIT)) {
      lines.push(`- ${a.url} scored ${a.score}`);
    }
  }

  // Said explicitly, so the model advises on getting started rather than on nothing.
  if (o.totals.audited === 0) lines.push('No audit has been run yet on any site.');

  return { scope: 'their whole account: every site they track', lines };
}

async function buildSiteContext(userId: string, url: string): Promise<{ scope: string; lines: string[] }> {
  const site = await findWebsiteByHost(userId, url);
  const runs = await HistoryModel
    .find({ userId, url, ...HAS_RESULT_FILTER })
    .sort({ createdAt: -1 })
    .limit(HISTORY_RUNS)
    .select('scores metrics createdAt')
    .lean();

  const lines: string[] = [`Page: ${url}`];

  if (site?.budgets) {
    const b = site.budgets;
    const parts = [
      b.performance ? `performance >= ${b.performance}` : null,
      b.lcp ? `LCP <= ${fmtMs(b.lcp)}` : null,
      b.tbt ? `TBT <= ${fmtMs(b.tbt)}` : null,
      b.cls ? `CLS <= ${b.cls}` : null,
    ].filter(Boolean);
    if (parts.length) lines.push(`Budget: ${parts.join(', ')}`);
  }

  if (!runs.length) {
    lines.push('No audits recorded for this page yet.');
    return { scope: `one page they track: ${url}`, lines };
  }

  // Oldest first, so a trend reads in the direction it happened.
  lines.push(`Last ${runs.length} audits, oldest first:`);
  for (const r of [...runs].reverse()) {
    const m = r.metrics;
    lines.push(`- score ${r.scores?.performance ?? '?'}, LCP ${fmtMs(m?.lcp ?? 0)}, TBT ${fmtMs(m?.tbt ?? 0)}, CLS ${m?.cls ?? '?'}`);
  }

  return { scope: `one page they track: ${url}`, lines };
}

/**
 * Advice for what the user is currently looking at, or null when there is nothing to say.
 *
 * No caching layer here on purpose: `AiService.generate` already caches by prompt hash for
 * six hours, and the prompt is built from the data — so a user reloading a dashboard that
 * has not changed pays for one call, and the moment an audit moves a number they get fresh
 * advice without anything having to invalidate a key.
 */
export async function getAdvice(
  userId: string, scope: AdviceScope, target?: string,
): Promise<AiAdvice | null> {
  if (!AiService.isAvailable()) return null;

  const context = await buildContext(userId, scope, target);
  return AiService.getAdvice(context).catch((err: unknown) => {
    console.error('[AI] Advice failed:', err);
    return null;
  });
}
