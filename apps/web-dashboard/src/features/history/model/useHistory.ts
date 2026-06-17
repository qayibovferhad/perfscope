import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import type { AnalysisResult } from '@/entities/analysis';
import type { HistoryEntry } from '@/entities/history';

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
