import type { RunnerResult } from 'lighthouse';
import type { NetworkRequest, ThirdPartyEntity } from '@perfscope/shared';

/** Vendors below this are noise in the UI; the table stays readable. */
const MIN_TRANSFER_BYTES = 1024;
const MAX_ENTITIES       = 12;

/** Lighthouse v12 reports the entity as a plain string; older versions as a link cell. */
function entityName(raw: unknown): string | null {
  if (typeof raw === 'string') return raw;
  const cell = raw as { text?: string; name?: string } | undefined;
  return cell?.text ?? cell?.name ?? null;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Per-vendor cost of the third-party code on the page.
 *
 * Primary source is Lighthouse's own `third-party-summary` audit, which already
 * attributes main-thread and blocking time to each entity — something we cannot
 * derive from the network log alone. When that audit is missing (it only runs in
 * the performance category) we fall back to a bytes-and-count roll-up by host so
 * the panel still says something true, just less.
 */
export function parseThirdParties(
  lhr: RunnerResult['lhr'],
  requests: NetworkRequest[] = [],
): ThirdPartyEntity[] | null {
  const fromAudit = fromSummaryAudit(lhr);
  if (fromAudit && fromAudit.length > 0) return fromAudit;

  const fromNetwork = fromRequests(requests);
  return fromNetwork.length > 0 ? fromNetwork : null;
}

function fromSummaryAudit(lhr: RunnerResult['lhr']): ThirdPartyEntity[] | null {
  const details = lhr.audits?.['third-party-summary']?.details as
    | { type?: string; items?: unknown[] }
    | undefined;
  if (!Array.isArray(details?.items)) return null;

  const entities: ThirdPartyEntity[] = [];
  for (const item of details.items) {
    const row  = item as Record<string, unknown>;
    const name = entityName(row['entity']);
    if (!name) continue;

    const subItems = (row['subItems'] as { items?: unknown[] } | undefined)?.items;
    entities.push({
      name,
      transferSize:   num(row['transferSize']),
      mainThreadTime: num(row['mainThreadTime']),
      blockingTime:   num(row['blockingTime']),
      requestCount:   Array.isArray(subItems) ? subItems.length : 0,
    });
  }

  return rank(entities);
}

function fromRequests(requests: NetworkRequest[]): ThirdPartyEntity[] {
  const byHost = new Map<string, ThirdPartyEntity>();

  for (const req of requests) {
    if (!req.isThirdParty) continue;
    let host: string;
    try { host = new URL(req.url).hostname; } catch { continue; }

    const entry = byHost.get(host) ?? {
      name: host, transferSize: 0, mainThreadTime: 0, blockingTime: 0, requestCount: 0,
    };
    entry.transferSize += req.transferSize ?? 0;
    entry.requestCount += 1;
    byHost.set(host, entry);
  }

  return rank([...byHost.values()]);
}

/** Heaviest first — blocking time dominates, bytes break ties. */
function rank(entities: ThirdPartyEntity[]): ThirdPartyEntity[] {
  return entities
    .filter(e => e.transferSize >= MIN_TRANSFER_BYTES || e.blockingTime > 0)
    .sort((a, b) => (b.blockingTime - a.blockingTime) || (b.transferSize - a.transferSize))
    .slice(0, MAX_ENTITIES);
}
