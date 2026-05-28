import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { AnalysisResult } from '@/features/analyzer/types';

export interface HistoryEntry {
  id:        string;
  shortId:   string;
  url:       string;
  timestamp: string;
  scores: {
    performance:   number;
    accessibility: number;
    bestPractices: number;
    seo:           number;
  };
  metrics: {
    fcp: number;
    lcp: number;
    tbt: number;
    cls: number;
    si:  number;
    tti: number;
  };
}

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
