import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import { toast } from '@/shared/ui/toast';
import { getHostname } from '../lib';
import type {
  WebsiteDoc as Website, AutomationScheduleMode, AutomationSlot,
} from '@perfscope/shared';

const KEY = ['websites'];

/**
 * What a write said when it failed.
 *
 * These mutations report through toasts, and "Request failed with status code 409" is not a
 * sentence: the server already explains itself in `error`, and that is the half worth
 * repeating.
 */
function reason(err: unknown): string | undefined {
  const data = (err as { response?: { data?: { error?: unknown; message?: unknown } } })?.response?.data;
  const text = data?.error ?? data?.message;
  return typeof text === 'string' && text.trim() ? text : undefined;
}

/**
 * Adding a site, enabling automation or saving a budget each complete an onboarding step,
 * and the checklist is rendered on the same page as the Add modal — with no remount to
 * trigger a refetch, it would sit there stale until the user navigated away and back.
 */
function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
  qc.invalidateQueries({ queryKey: ['onboarding'] });
}

export function useWebsites() {
  const qc = useQueryClient();

  const query = useQuery<Website[]>({
    queryKey: KEY,
    queryFn:  async () => {
      const res = await apiClient.get<Website[]>('/websites');
      return res.data;
    },
  });

  // Adding and removing a site are the two writes with nothing else on screen to confirm
  // them: the modal closes, a card appears or disappears somewhere in a list, and that is
  // all. The others (budgets, automation, sessions) each leave visible state behind them.
  const add = useMutation({
    mutationFn: (payload: { url: string; name?: string }) =>
      apiClient.post<Website>('/websites', payload).then((r) => r.data),
    onSuccess: (site) => {
      invalidate(qc);
      toast.success(`${getHostname(site.url)} added`, { description: 'Run an audit or put it on a schedule.' });
    },
    onError: (err) => toast.error('Could not add that site', { ...(reason(err) ? { description: reason(err)! } : {}) }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/websites/${id}`),
    onSuccess:  () => {
      invalidate(qc);
      toast.success('Site removed');
    },
    onError: (err) => toast.error('Could not remove that site', { ...(reason(err) ? { description: reason(err)! } : {}) }),
  });

  const saveSession = useMutation({
    mutationFn: ({ id, sessionData }: { id: string; sessionData: { cookies: unknown[]; localStorage: Record<string, string> } }) =>
      apiClient.patch<Website>(`/websites/${id}/session`, sessionData).then(r => r.data),
    onSuccess: () => invalidate(qc),
  });

  const setBudgets = useMutation({
    mutationFn: ({ id, ...budgets }: { id: string; performance?: number | null; lcp?: number | null; tbt?: number | null; cls?: number | null; inp?: number | null; webhookUrl?: string | null; alertEmail?: string | null }) =>
      apiClient.patch<Website>(`/websites/${id}/budgets`, budgets).then(r => r.data),
    onSuccess: () => invalidate(qc),
  });

  const setAutomation = useMutation({
    mutationFn: ({ id, ...patch }: {
      id:             string;
      enabled?:       boolean;
      routes?:        string[];
      scheduleTime?:  string;
      scheduleMode?:  AutomationScheduleMode;
      slots?:         AutomationSlot[];
      spreadMinutes?: number;
    }) =>
      apiClient.patch<Website>(`/websites/${id}/automation`, patch).then(r => r.data),
    onSuccess: () => invalidate(qc),
  });

  const triggerRun = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/websites/${id}/automation/run`).then(r => r.data),
  });

  return {
    websites: query.data ?? [],
    isLoading: query.isLoading,
    // Exposed so callers can tell "you have no websites" apart from "we could not ask".
    isError:  query.isError,
    refetch:  query.refetch,
    add, remove, saveSession, setAutomation, setBudgets, triggerRun,
  };
}
