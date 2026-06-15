import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';

export interface CompareEntry {
  id:             string;
  pairId:         string;
  sourceUrl:      string;
  targetUrl:      string;
  sourceHostname: string;
  targetHostname: string;
  source:         { scores: Record<string, number>; metrics: Record<string, number> };
  competitor:     { scores: Record<string, number>; metrics: Record<string, number> };
  winner:         'source' | 'competitor' | 'tie';
  timestamp:      string;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await apiClient.get<{ success: boolean; data: T }>(path);
  return res.data.data;
}

export function useCompareHistoryList(search: string) {
  return useQuery<CompareEntry[]>({
    queryKey: ['compare-history', 'list', search],
    queryFn:  () => fetchJson<CompareEntry[]>(
      `/compare-history${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ),
    staleTime: 0,
  });
}

export function useCompareHistoryPair(pairId: string | null) {
  return useQuery<CompareEntry[]>({
    queryKey: ['compare-history', 'pair', pairId],
    enabled:  !!pairId,
    queryFn:  () => fetchJson<CompareEntry[]>(`/compare-history/${encodeURIComponent(pairId!)}`),
    staleTime: 0,
  });
}
