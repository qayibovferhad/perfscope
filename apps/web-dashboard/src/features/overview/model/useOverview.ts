import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/shared/api/client';
import type { OverviewData, OverviewRange } from '@perfscope/shared';

/**
 * The account at a glance: totals, open incidents, recent runs, and what needs action.
 *
 * The window and the site are part of the key, not just the request — two ranges are two
 * different answers, and caching them under one key is how switching back to a range you
 * already looked at shows you the other one for a frame.
 *
 * The window is sent as the resolved pair rather than as whatever the URL happened to say.
 * `?days=7` and an explicit week are the same question, and asking it two ways would cache
 * one answer twice — and, worse, let the two disagree about which day the week ends on.
 */
export function useOverview(range: OverviewRange, websiteId?: string) {
  return useQuery<OverviewData>({
    queryKey: ['overview', range.from, range.to, websiteId ?? null],
    queryFn: () => fetchJson<OverviewData>('/overview', {
      from: range.from,
      to:   range.to,
      ...(websiteId ? { websiteId } : {}),
    }),
    // A range the user has already seen should come back instantly while it revalidates.
    placeholderData: (previous) => previous,
    // An audit finishing or an alert firing changes this page, and it is the screen a
    // user leaves open — short enough to keep up, long enough not to poll on every focus.
    staleTime: 60_000,
    // A failed overview must degrade to empty cards, not an error page: the sidebar and
    // every other route have to stay usable.
    retry: false,
  });
}
