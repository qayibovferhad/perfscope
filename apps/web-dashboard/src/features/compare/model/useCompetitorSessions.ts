import { useQuery } from '@tanstack/react-query';
import type { CompetitorSessionEntry } from '@perfscope/shared';
import { apiClient } from '@/shared/api/client';

export type { CompetitorSessionEntry };

export function useCompetitorSessions() {
  const query = useQuery<CompetitorSessionEntry[]>({
    queryKey: ['competitor-sessions'],
    queryFn:  () => apiClient.get<CompetitorSessionEntry[]>('/competitor-sessions').then(r => r.data),
  });

  return { sessions: query.data ?? [], isLoading: query.isLoading };
}
