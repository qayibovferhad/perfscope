import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import type { OverviewData } from '@perfscope/shared';

/** The account at a glance: totals, open incidents, recent runs, and what needs action. */
export function useOverview() {
  return useQuery<OverviewData>({
    queryKey: ['overview'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: OverviewData }>('/overview');
      return res.data.data;
    },
    // An audit finishing or an alert firing changes this page, and it is the screen a
    // user leaves open — short enough to keep up, long enough not to poll on every focus.
    staleTime: 60_000,
    // A failed overview must degrade to empty cards, not an error page: the sidebar and
    // every other route have to stay usable.
    retry: false,
  });
}
