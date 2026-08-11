import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import type { AuditFormFactor } from '@/entities/analysis';
import type { RumSummary, RumPathRow, RumTrend, RumMetricKey } from '@perfscope/shared';

export interface RumResponse {
  summary: RumSummary;
  paths:   RumPathRow[];
  /** null until the user has generated a snippet for this site. */
  rumKey:  string | null;
}

interface Params {
  websiteId: string;
  days?:     number;
  device?:   AuditFormFactor | 'all';
}

/** Field data from the site's own visitors, aggregated to p75 by the backend. */
export function useRum({ websiteId, days = 7, device = 'all' }: Params) {
  return useQuery<RumResponse>({
    queryKey: ['rum', websiteId, days, device],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: RumResponse }>(
        `/websites/${websiteId}/rum`,
        { params: { days, ...(device !== 'all' ? { device } : {}) } },
      );
      return res.data.data;
    },
    enabled: Boolean(websiteId),
    // Beacons arrive continuously; a minute-old aggregate is plenty fresh.
    staleTime: 60_000,
  });
}

/** Daily p75 for one metric, for the trend chart. */
export function useRumTrend({ websiteId, metric, days = 30, device = 'all' }: Params & { metric: RumMetricKey }) {
  return useQuery<RumTrend>({
    queryKey: ['rum', websiteId, 'trend', metric, days, device],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: RumTrend }>(
        `/websites/${websiteId}/rum/trend`,
        { params: { metric, days, ...(device !== 'all' ? { device } : {}) } },
      );
      return res.data.data;
    },
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
