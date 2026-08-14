import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, fetchJson } from '@/shared/api/client';
import type { AuditFormFactor } from '@/entities/analysis';
import type { RumTrend, RumMetricKey, RumResponse } from '@perfscope/shared';

export type { RumResponse };

interface Params {
  websiteId: string;
  days?:     number;
  device?:   AuditFormFactor | 'all';
}

/** Field data from the site's own visitors, aggregated to p75 by the backend. */
export function useRum({ websiteId, days = 7, device = 'all' }: Params) {
  return useQuery<RumResponse>({
    queryKey: ['rum', websiteId, days, device],
    queryFn: () => fetchJson<RumResponse>(
      `/websites/${websiteId}/rum`,
      { days, ...(device !== 'all' ? { device } : {}) },
    ),
    enabled: Boolean(websiteId),
    // Beacons arrive continuously; a minute-old aggregate is plenty fresh.
    staleTime: 60_000,
  });
}

/** Daily p75 for one metric, for the trend chart. */
export function useRumTrend({ websiteId, metric, days = 30, device = 'all' }: Params & { metric: RumMetricKey }) {
  return useQuery<RumTrend>({
    queryKey: ['rum', websiteId, 'trend', metric, days, device],
    queryFn: () => fetchJson<RumTrend>(
      `/websites/${websiteId}/rum/trend`,
      { metric, days, ...(device !== 'all' ? { device } : {}) },
    ),
    enabled: Boolean(websiteId),
    staleTime: 60_000,
  });
}

/** Issues the site key, or rotates it — the old snippet stops reporting once rotated. */
export function useIssueRumKey(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ success: boolean; data: { rumKey: string } }>(
        `/websites/${websiteId}/rum-key`,
      );
      return res.data.data.rumKey;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rum', websiteId] }),
  });
}
