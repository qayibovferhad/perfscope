/**
 * A vendor that costs this page something and *also* costs several of the user's other
 * tracked pages the same thing is not this page's problem — it's a site-wide tag-manager
 * or vendor-governance problem, and the fix is different (remove/replace the vendor once,
 * not chase it page by page). Pure: no I/O, the DB lookup lives in
 * `crossPageVendors.service.ts`.
 */

export interface DiffableVendorCost {
  name:         string
  blockingTime: number
}

export interface OtherRouteVendors {
  routePath: string
  vendors:   DiffableVendorCost[]
}

export interface SitewideVendor {
  name:   string
  hereMs: number
  /** Other routes where the same vendor also costs a notable amount, heaviest first. */
  otherRoutes: { routePath: string; blockingMs: number }[]
}

/** A vendor has to cost at least this much on a route to count as "a problem" there —
 *  a vendor that shows up everywhere at 2ms is not a finding. */
const NOTABLE_BLOCKING_MS = 50;
/** Has to show up on at least this many OTHER routes to be "site-wide" rather than
 *  "also happens to be on one other page". */
const MIN_OTHER_ROUTES = 2;
const TOP_N = 5;

export function findSitewideVendors(
  currentVendors: DiffableVendorCost[],
  otherRoutes: OtherRouteVendors[],
): SitewideVendor[] {
  const out: SitewideVendor[] = [];

  for (const v of currentVendors) {
    if (v.blockingTime < NOTABLE_BLOCKING_MS) continue;

    const matches: SitewideVendor['otherRoutes'] = [];
    for (const route of otherRoutes) {
      const match = route.vendors.find(rv => rv.name === v.name && rv.blockingTime >= NOTABLE_BLOCKING_MS);
      if (match) matches.push({ routePath: route.routePath, blockingMs: Math.round(match.blockingTime) });
    }
    if (matches.length < MIN_OTHER_ROUTES) continue;

    out.push({
      name: v.name,
      hereMs: Math.round(v.blockingTime),
      otherRoutes: matches.sort((a, b) => b.blockingMs - a.blockingMs).slice(0, TOP_N),
    });
  }

  return out.sort((a, b) => b.otherRoutes.length - a.otherRoutes.length);
}
