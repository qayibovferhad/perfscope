import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import type { AnalysisResult, HistoryEntry } from '@perfscope/shared';

export function useHistory(url: string | null) {
  return useQuery<HistoryEntry[]>({
    queryKey: ['history', url],
    enabled:  !!url,
    queryFn:  async () => {
      const res = await apiClient.get<{ success: boolean; data: HistoryEntry[] }>(
        `/history?url=${encodeURIComponent(url!)}`,
      );
      return res.data.data ?? [];
    },
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
  const res = await apiClient.get<{ success: boolean; data: AnalysisResult }>(
    `/history/${encodeURIComponent(analysisId)}`,
  );
  return res.data.data;
}

export function useAllHistory() {
  return useQuery<HistoryEntry[]>({
    queryKey: ['history', 'all'],
    queryFn:  async () => {
      const res = await apiClient.get<{ success: boolean; data: HistoryEntry[] }>('/history/all');
      return res.data.data ?? [];
    },
    staleTime: 0,
  });
}
