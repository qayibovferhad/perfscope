import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, fetchJson } from '@/shared/api/client';
import type { NotificationsResponse } from '@perfscope/shared';

const KEY = ['notifications'];

/**
 * What has been raised for this account, and how much of it is new.
 *
 * Polled rather than pushed: alerts are raised by the nightly cron and by audits started
 * elsewhere (the CLI, a schedule, another tab), so there is no socket the browser is
 * already listening on that would know. A minute is well inside the time it takes anyone
 * to notice, and the query is three small documents.
 */
export function useNotifications() {
  const qc = useQueryClient();

  const query = useQuery<NotificationsResponse>({
    queryKey: KEY,
    queryFn:  () => fetchJson<NotificationsResponse>('/notifications'),
    refetchInterval: 60_000,
    staleTime: 30_000,
    // The bell sits in the shell on every page: a failure here must be a bell with no
    // badge, never an error that takes the layout down with it.
    retry: false,
  });

  const markSeen = useMutation({
    mutationFn: () => apiClient.post('/notifications/seen'),
    // Optimistic on purpose: the badge is the one thing the user is looking at when they
    // click, and a badge that lingers for a round trip reads as "it did not work".
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<NotificationsResponse>(KEY);
      if (previous) {
        qc.setQueryData<NotificationsResponse>(KEY, {
          ...previous,
          unread: 0,
          entries: previous.entries.map(e => ({ ...e, unread: false })),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(KEY, context.previous);
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: KEY }); },
  });

  return {
    entries: query.data?.entries ?? [],
    unread:  query.data?.unread ?? 0,
    isLoading: query.isLoading,
    isError:   query.isError,
    markSeen:  markSeen.mutate,
  };
}
