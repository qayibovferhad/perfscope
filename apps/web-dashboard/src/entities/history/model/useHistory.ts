import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, fetchJson } from '@/shared/api/client';
import type { AnalysisResult, HistoryEntry, ScheduledSiteGroup } from '@perfscope/shared';

export function useHistory(url: string | null) {
  return useQuery<HistoryEntry[]>({
    queryKey: ['history', url],
    enabled:  !!url,
    queryFn:  async () => (await fetchJson<HistoryEntry[]>(`/history?url=${encodeURIComponent(url!)}`)) ?? [],
    staleTime: 0,
  });
}

/**
 * Deletes a single audit. Invalidates every view built on history — the project detail
 * table, the history page, and the websites list, whose score rings and summary strip are
 * derived from the same entries.
 */
export function useDeleteAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (analysisId: string) =>
      apiClient.delete(`/history/${encodeURIComponent(analysisId)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['history'] });
      qc.invalidateQueries({ queryKey: ['project-audits'] });
      qc.invalidateQueries({ queryKey: ['websites'] });
    },
  });
}

export async function fetchHistoryResult(analysisId: string): Promise<AnalysisResult> {
  return fetchJson<AnalysisResult>(`/history/${encodeURIComponent(analysisId)}`);
}

export function useAllHistory() {
  return useQuery<HistoryEntry[]>({
    queryKey: ['history', 'all'],
    queryFn:  async () => (await fetchJson<HistoryEntry[]>('/history/all')) ?? [],
    staleTime: 0,
  });
}

/**
 * What the automation ran, grouped by site and route.
 *
 * Its own query rather than a filter over `useAllHistory`: the audit lists deliberately
 * exclude scheduled runs, so they are never in that cache to filter.
 */
export function useScheduledRuns() {
  return useQuery<ScheduledSiteGroup[]>({
    queryKey: ['history', 'scheduled'],
    queryFn:  async () => (await fetchJson<ScheduledSiteGroup[]>('/history/scheduled')) ?? [],
    staleTime: 0,
  });
}
