import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
// The wire shapes live in @perfscope/shared so the routes that build them are checked
// against the same declarations the client reads.
export type { WebsitePage, WebsiteSummary } from '@perfscope/shared';
import type { WebsitePage, WebsiteSummary } from '@perfscope/shared';

interface PageParams { q: string; page: number; limit: number }

/**
 * Server-side paginated + filtered website list.
 *
 * The key is prefixed with 'websites' so the mutations in `useWebsites`
 * (add / remove / saveSession / setAutomation) invalidate these entries too.
 */
export function useWebsitesPage({ q, page, limit }: PageParams) {
  return useQuery<WebsitePage>({
    queryKey: ['websites', 'page', { q, page, limit }],
    queryFn: async () => {
      const res = await apiClient.get<WebsitePage>('/websites', { params: { q, page, limit } });
      return res.data;
    },
    // Keep the previous page on screen while the next one loads — avoids a full-grid flash.
    placeholderData: keepPreviousData,
  });
}

/**
 * Account-wide headline counts. Independent of the list's search term, so the
 * summary strip stays on screen while filtering — including when nothing matches.
 */
export function useWebsitesSummary() {
  return useQuery<WebsiteSummary>({
    queryKey: ['websites', 'summary'],
    queryFn: async () => {
      const res = await apiClient.get<WebsiteSummary>('/websites/summary');
      return res.data;
    },
  });
}
