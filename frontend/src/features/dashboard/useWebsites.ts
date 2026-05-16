import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

export interface WebsiteSession {
  capturedAt: string;
  cookies: Array<{ name?: string; value?: string; domain?: string }>;
  localStorage: Record<string, string>;
}

export interface Website {
  _id:       string;
  url:       string;
  name:      string;
  createdAt: string;
  session:   WebsiteSession | null;
}

const KEY = ['websites'];

export function useWebsites() {
  const qc = useQueryClient();

  const query = useQuery<Website[]>({
    queryKey: KEY,
    queryFn:  async () => {
      const res = await apiClient.get<Website[]>('/websites');
      return res.data;
    },
  });

  const add = useMutation({
    mutationFn: (payload: { url: string; name?: string }) =>
      apiClient.post<Website>('/websites', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/websites/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const saveSession = useMutation({
    mutationFn: ({ id, sessionData }: { id: string; sessionData: { cookies: unknown[]; localStorage: Record<string, string> } }) =>
      apiClient.patch<Website>(`/websites/${id}/session`, sessionData).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return { websites: query.data ?? [], isLoading: query.isLoading, add, remove, saveSession };
}
