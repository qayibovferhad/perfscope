import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';

export interface CompetitorSessionEntry {
  _id:       string;
  url:       string;
  name:      string;
  createdAt: string;
  session:   { capturedAt: string } | null;
}

export function useCompetitorSessions() {
  const query = useQuery<CompetitorSessionEntry[]>({
    queryKey: ['competitor-sessions'],
    queryFn:  () => apiClient.get<CompetitorSessionEntry[]>('/competitor-sessions').then(r => r.data),
  });

  return { sessions: query.data ?? [], isLoading: query.isLoading };
}
