import type { ResourceDiff } from '@/entities/analysis';

/** How a request in *this* run differs from the previous one. */
export type ResourceChange = 'added' | 'grown' | 'shrunk';

/**
 * Request URL → what changed about it, for tagging waterfall rows.
 *
 * Only changes that describe a row the waterfall actually draws are in here: `added`,
 * `grown` and `shrunk` all carry the current run's URL, while `removed` names a request
 * this run never made and therefore has no row to tag — those are listed in the
 * "since last run" strip instead.
 *
 * Keyed on the full URL rather than the diff's own origin+path key, because that is what a
 * row has in hand. The two agree for everything except cache-busted URLs, which the diff
 * deliberately matches loosely and which therefore simply go untagged rather than
 * mis-tagged.
 */
export function buildChangeMap(diff: ResourceDiff | undefined): Map<string, ResourceChange> {
  const map = new Map<string, ResourceChange>();
  if (!diff) return map;

  for (const r of diff.added)  map.set(r.url, 'added');
  for (const r of diff.grown)  map.set(r.url, 'grown');
  for (const r of diff.shrunk) map.set(r.url, 'shrunk');
  return map;
}
