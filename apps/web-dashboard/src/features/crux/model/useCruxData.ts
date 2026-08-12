import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/shared/api/client';
import type { AuditFormFactor } from '@/entities/analysis';
// CruxData has no entity-layer alias yet; the shared package is the source of truth.
import type { CruxData } from '@perfscope/shared';

/**
 * Real-user (field) data from the Chrome UX Report for a page.
 *
 * Resolves to `null` — not an error — when CrUX has nothing for the URL or its
 * origin, or when the backend has no CRUX_API_KEY. The panel treats both the same:
 * lab numbers stand on their own.
 */
export function useCruxData(url: string | null | undefined, formFactor: AuditFormFactor) {
  return useQuery<CruxData | null>({
    queryKey: ['crux', url, formFactor],
    queryFn:  async () => (await fetchJson<CruxData | null>('/crux', { url, formFactor })) ?? null,
    enabled: Boolean(url),
    // CrUX aggregates 28 days and refreshes daily — the backend already caches 6h.
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });
}
