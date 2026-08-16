import type { AiAdvice } from '@perfscope/shared';
import { AiService } from './ai.service.js';
import { getOverview } from './overview.service.js';
import { findWebsiteByHost } from './websiteLookup.js';
import { getActionOutcome } from './adviceAction.service.js';
import { CruxService } from './crux.service.js';
import { getOtherRoutesVendors } from './crossPageVendors.service.js';
import { findSitewideVendors } from '../lib/crossPageVendors.js';
import { compareLabAndField } from '../lib/labFieldComparison.js';
import { HistoryModel } from '../models/History.model.js';
import { HAS_RESULT_FILTER } from '../lib/history.js';
import {
  fmtMs, fmtCls, targetProgress, readTargetValue, TARGET_DIRECTION, forecastMetric,
  type TargetMetric, type TargetProgress, type ForecastMetric,
} from '@perfscope/shared';

const FORECAST_METRICS: ForecastMetric[] = ['performance', 'lcp', 'tbt', 'cls'];

/** How a metric's forecast reads as a line of prose for the model, not the Targets tab's
 *  own formatting (that lives in the web-dashboard) — just enough for it to reason about
 *  pace without inventing a number that isn't here. */
function describeForecastLine(metric: ForecastMetric, budget: number | null, forecast: ReturnType<typeof forecastMetric>): string | null {
  if (!forecast || forecast.confidence === 'low') return null;
  const unit = (v: number) => metric === 'performance' ? String(Math.round(v)) : metric === 'cls' ? fmtCls(v) : fmtMs(v);
  const label = metric.toUpperCase();

  if (forecast.direction === 'flat') return `${label} holding steady around ${unit(forecast.current)}.`;

  const verb = forecast.slopePerDay > 0 ? 'rising' : 'falling';
  const pace = `${label} is ${verb}, now ${unit(forecast.current)}`;
  if (budget !== null && forecast.daysToBudget !== null) {
    return `${pace} — at this rate, crosses the ${unit(budget)} target in ~${Math.round(forecast.daysToBudget)} days.`;
  }
  return `${pace}.`;
}

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
    // fullResult.thirdParty/formFactor ride along on all six rows returned (Mongo has no
    // per-document projection), but only `latest`'s copy — the newest run — is ever read,
    // for the sitewide-vendor and lab-vs-field checks below.
    .select('scores metrics createdAt fullResult.thirdParty fullResult.formFactor')
    .lean();

  const lines: string[] = [`Page: ${url}`];

  // Closing the loop: if they acted on a past "audit this" suggestion and the result is
  // still fresh news (see getActionOutcome's own gating), that is the most important
  // thing on the page right now — ahead of anything else in the context.
  const outcome = await getActionOutcome(userId, url).catch(() => null);
  if (outcome) lines.push(outcome);

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

  // Same fit the Targets tab draws (forecastMetric, shared) — turns "here is what
  // happened" into "here is where this is headed", the difference between reporting a
  // number and coaching toward one. Silently skipped per metric when there isn't enough
  // signal yet (forecastMetric returns null, or its own confidence is 'low').
  const forecastLines = FORECAST_METRICS
    .map(metric => {
      const budget  = (site?.budgets?.[metric] ?? null) as number | null;
      const samples = [...runs].reverse().map(r => ({
        at:    String(r.createdAt),
        value: metric === 'performance' ? (r.scores?.performance ?? 0) : (r.metrics?.[metric] ?? 0),
      }));
      return describeForecastLine(metric, budget, forecastMetric(metric, samples, budget));
    })
    .filter((l): l is string => l !== null);

  if (forecastLines.length) {
    lines.push('Trend:');
    for (const l of forecastLines) lines.push(`- ${l}`);
  }

  const latestFull = (latest as unknown as {
    fullResult?: { thirdParty?: { name?: string; blockingTime?: number }[]; formFactor?: 'mobile' | 'desktop' };
  } | undefined)?.fullResult;

  // The same "not just this page's problem" check analysePage runs per audit, now at the
  // scope the advisor actually coaches at: the whole site.
  const siteVendors = latestFull?.thirdParty ?? [];
  if (siteVendors.length > 0) {
    const otherRoutes = await getOtherRoutesVendors(userId, url).catch(() => []);
    if (otherRoutes.length > 0) {
      const sitewide = findSitewideVendors(
        siteVendors.filter((t): t is { name: string; blockingTime: number } => typeof t.name === 'string')
          .map(t => ({ name: t.name, blockingTime: t.blockingTime ?? 0 })),
        otherRoutes,
      );
      if (sitewide.length > 0) {
        lines.push('Also weighing down other pages on this site:');
        for (const v of sitewide) {
          lines.push(`- ${v.name}: ${v.hereMs}ms here, and ${v.otherRoutes.length} other route${v.otherRoutes.length === 1 ? '' : 's'} (${v.otherRoutes.map(r => `${r.routePath} ${r.blockingMs}ms`).join(', ')})`);
        }
      }
    }
  }

  // Real users, same lab-vs-field comparison analysePage makes per audit — at the site
  // scope this reads as "is this page's lab score representative of who actually visits it".
  const fieldData = await CruxService.get(url, latestFull?.formFactor ?? 'desktop').catch(() => null);
  if (fieldData && latest?.metrics) {
    const gaps = compareLabAndField(
      { lcp: latest.metrics.lcp ?? 0, cls: latest.metrics.cls ?? 0, fcp: latest.metrics.fcp ?? 0 },
      fieldData,
    );
    if (gaps.length > 0) {
      const fmtVal = (m: string, v: number) => m === 'cls' ? v.toFixed(3) : fmtMs(v);
      lines.push(`Real users (CrUX, ${fieldData.collectedFrom} to ${fieldData.collectedTo}) vs this lab run:`);
      for (const g of gaps) {
        lines.push(`- ${g.metric.toUpperCase()}: lab ${fmtVal(g.metric, g.labValue)}, real p75 ${fmtVal(g.metric, g.fieldP75)} — ${g.gap > 0 ? 'worse' : 'better'} for real users`);
      }
    }
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
