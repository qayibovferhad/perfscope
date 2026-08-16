import { HistoryModel } from '../models/History.model.js';
import { HAS_RESULT_FILTER } from '../lib/history.js';
import { normalizedUrlHostRegex, hostOf } from '../lib/url.js';
import type { OtherRouteVendors } from '../lib/crossPageVendors.js';

/**
 * The latest audited state of every OTHER route this user tracks under the same host,
 * one row per distinct route, newest first — what `findSitewideVendors` compares the
 * current page's vendors against. Capped at 20 routes; a site with more than that is rare
 * and the heaviest offenders are what matters, not an exhaustive list.
 */
export async function getOtherRoutesVendors(
  userId: string, currentUrl: string,
): Promise<OtherRouteVendors[]> {
  const host = hostOf(currentUrl);
  if (!host) return [];

  const rows = await HistoryModel.aggregate([
    {
      $match: {
        userId, url: { $ne: currentUrl },
        normalizedUrl: normalizedUrlHostRegex(host),
        ...HAS_RESULT_FILTER,
      },
    },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$routePath', doc: { $first: '$$ROOT' } } },
    { $limit: 20 },
  ]).catch(() => [] as unknown[]);

  return (rows as { _id: string; doc: { fullResult?: { thirdParty?: { name?: string; blockingTime?: number }[] } } }[])
    .map(r => ({
      routePath: r._id,
      vendors: (r.doc.fullResult?.thirdParty ?? [])
        .filter((t): t is { name: string; blockingTime: number } => typeof t.name === 'string')
        .map(t => ({ name: t.name, blockingTime: t.blockingTime ?? 0 })),
    }));
}
