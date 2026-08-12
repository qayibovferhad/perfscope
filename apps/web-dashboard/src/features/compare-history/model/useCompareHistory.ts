import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/shared/api/client';
import type { CompareEntry } from '@perfscope/shared';

export type { CompareEntry };

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
