import { Website } from '../models/Website.model.js';
import { hostOf, hostPrefixRegex } from '../lib/url.js';

/**
 * The user's website that owns this URL, matched on hostname because audits run per
 * route while sites are per host.
 *
 * Shared: the socket handler, the budget check and the regression check each had their
 * own identical copy, so "which site does this audit belong to?" was answered in three
 * places that could drift apart while all three fed the same alerts.
 */
export async function findWebsiteByHost(userId: string, url: string) {
  const host = hostOf(url);
  if (!host) return null;

  return Website.findOne({
    userId,
    url: { $regex: hostPrefixRegex(host).source, $options: 'i' },
  });
}

/**
 * What findWebsiteByHost returns: the owning site, or null when the audited URL belongs
 * to no tracked site (or there is no user). Named so the checks downstream of an audit can
 * take an already-resolved handle instead of each running the lookup again.
 */
export type OwningSite = Awaited<ReturnType<typeof findWebsiteByHost>>;
