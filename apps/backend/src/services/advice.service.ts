import type { AiAdvice } from '@perfscope/shared';
import { AiService } from './ai.service.js';
import { getOverview } from './overview.service.js';
import { findWebsiteByHost } from './websiteLookup.js';
import { HistoryModel } from '../models/History.model.js';
import { HAS_RESULT_FILTER } from '../lib/history.js';
import {
  fmtMs, fmtCls, targetProgress, readTargetValue, TARGET_DIRECTION,
  type TargetMetric, type TargetProgress,
} from '@perfscope/shared';

/** One target, in the units and direction a person reads it in. */
function describeTarget(p: TargetProgress): string {
  const unit = (v: number) =>
    p.metric === 'performance' ? String(Math.round(v))
    : p.metric === 'cls'       ? fmtCls(v)
    : fmtMs(v);

  const comparator = TARGET_DIRECTION[p.metric] === 'floor' ? 'at least' : 'at most';
  const state = p.met
    ? 'met'
    : `short by ${unit(p.gap)}`;

  return `${p.metric.toUpperCase()} target ${comparator} ${unit(p.target)}, now ${unit(p.value)} — ${state}`;
}

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
): Promise<{ scope: string; lines: string[]; knownUrls: string[] }> {
  if (scope === 'site' && target) return buildSiteContext(userId, target);
  return buildOverviewContext(userId);
}

async function buildOverviewContext(
  userId: string,
): Promise<{ scope: string; lines: string[]; knownUrls: string[] }> {
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

  // What a step may link to. Collected from the same data the model is shown, so it can
  // only ever attach an action to a site the user actually has.
  const knownUrls = [...new Set([
    ...o.attention.map(a => a.url),
    ...o.incidents.map(i => i.url),
    ...o.recentAudits.map(a => a.url),
  ])];

  return { scope: 'their whole account: every site they track', lines, knownUrls };
}

async function buildSiteContext(
  userId: string, url: string,
): Promise<{ scope: string; lines: string[]; knownUrls: string[] }> {
  const site = await findWebsiteByHost(userId, url);
  const runs = await HistoryModel
    .find({ userId, url, ...HAS_RESULT_FILTER })
    .sort({ createdAt: -1 })
    .limit(HISTORY_RUNS)
    .select('scores metrics createdAt')
    .lean();

  const lines: string[] = [`Page: ${url}`];
  const latest = runs[0];

  // Targets turn the advisor from a commentator into a coach: told what the user is aiming
  // for and exactly how far short each metric is, it plans a route there instead of listing
  // whatever happens to be worst.
  if (site?.budgets && latest) {
    const progress = (Object.keys(TARGET_DIRECTION) as TargetMetric[])
      .map(metric => targetProgress(
        metric,
        readTargetValue(metric, latest.scores as never, latest.metrics as never),
        site.budgets![metric],
      ))
      .filter((p): p is NonNullable<typeof p> => p !== null);

    if (progress.length) {
      const missed = progress.filter(p => !p.met);
      lines.push(missed.length
        ? `They have set targets and are short on ${missed.length} of ${progress.length}:`
        : 'They have set targets and are currently meeting all of them:');

      for (const p of progress) {
        lines.push(`- ${describeTarget(p)}`);
      }

      lines.push(missed.length
        ? 'Plan the route to those targets. Say which single change moves the most, and roughly how much of the gap it closes.'
        : 'Say what would most likely push them back over a target, and what to watch.');
    }
  }

  if (!runs.length) {
    lines.push('No audits recorded for this page yet.');
    return { scope: `one page they track: ${url}`, lines, knownUrls: [url] };
  }

  // Oldest first, so a trend reads in the direction it happened.
  lines.push(`Last ${runs.length} audits, oldest first:`);
  for (const r of [...runs].reverse()) {
    const m = r.metrics;
    lines.push(`- score ${r.scores?.performance ?? '?'}, LCP ${fmtMs(m?.lcp ?? 0)}, TBT ${fmtMs(m?.tbt ?? 0)}, CLS ${m?.cls ?? '?'}`);
  }

  return { scope: `one page they track: ${url}`, lines, knownUrls: [url] };
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
