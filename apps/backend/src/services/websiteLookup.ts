import { Website } from '../models/Website.model.js';
import { hostOf, hostPrefixRegex } from '../lib/url.js';

/**
 * The Mongo filter for "this user's documents on this URL's host" — the indexed `userId`
 * plus an anchored host match. It narrows, it never authorises: the regex matches either
 * scheme and any port, so wherever origin equality is the security boundary (session
 * injection), `sameOrigin` still decides on the survivors. Null when the URL has no
 * parseable host — nothing can match, so do not query at all.
 *
 * Exported because `sessionStore` scopes its session lookups with the exact same filter;
 * that copy was the access boundary for injecting saved credentials, and a security
 * predicate should have one definition.
 */
export function siteHostFilter(userId: string, url: string) {
  const host = hostOf(url);
  if (!host) return null;
  return { userId, url: { $regex: hostPrefixRegex(host).source, $options: 'i' } };
}

/**
 * The user's website that owns this URL, matched on hostname because audits run per
 * route while sites are per host.
 *
 * Shared: the socket handler, the budget check and the regression check each had their
 * own identical copy, so "which site does this audit belong to?" was answered in three
 * places that could drift apart while all three fed the same alerts.
 */
export async function findWebsiteByHost(userId: string, url: string) {
  const filter = siteHostFilter(userId, url);
  return filter ? Website.findOne(filter) : null;
}

/**
 * What findWebsiteByHost returns: the owning site, or null when the audited URL belongs
 * to no tracked site (or there is no user). Named so the checks downstream of an audit can
 * take an already-resolved handle instead of each running the lookup again.
 */
export type OwningSite = Awaited<ReturnType<typeof findWebsiteByHost>>;
