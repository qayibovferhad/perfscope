import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/shared/api/client';
import type { AiAdvice } from '@perfscope/shared';

export type AdviceScope = 'overview' | 'site';

/**
 * What the advisor has to say about what the user is looking at.
 *
 * Its own request rather than a field on the page's data, so no page ever waits on a
 * Gemini round trip to render — the same split the analyzer uses for its commentary.
 *
 * `null` is a normal answer, not an error: it is what a deployment with no `GEMINI_API_KEY`
 * returns, and the UI's job is simply not to render.
 */
export function useAdvice(scope: AdviceScope = 'overview', url?: string) {
  return useQuery<AiAdvice | null>({
    queryKey: ['advice', scope, url ?? null],
    queryFn: () => fetchJson<AiAdvice | null>('/advice', { scope, ...(url ? { url } : {}) }),
    // Long, because the server caches the prompt for six hours anyway and this is a panel
    // the user leaves open. Refetching it on every navigation would spend a Gemini call to
    // redraw the same words.
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    // Advice is the first thing to give up: never let it retry into a page that is fine.
    retry: false,
  });
}
