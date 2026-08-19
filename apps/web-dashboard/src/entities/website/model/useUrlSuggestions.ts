import { useMemo } from 'react';
import { useWebsites } from './useWebsites';
import { useAllHistory } from '@/entities/history';
import type { UrlSuggestion } from '@/shared/ui/url-combobox';

/**
 * What a URL field can offer as you type — tracked sites first (the account's own,
 * deliberate list), then every distinct page audited before that isn't already tracked.
 * Both queries are already fetched elsewhere on most pages this feeds (websites for the
 * sidebar counts, history for the history page); React Query dedupes by key, so calling
 * this from more than one input on the same page — Compare's two sides — costs no extra
 * request.
 */
export function useUrlSuggestions(): UrlSuggestion[] {
  const { websites } = useWebsites();
  const { data: history } = useAllHistory();

  return useMemo(() => {
    const seen = new Set<string>();
    const out: UrlSuggestion[] = [];

    for (const w of websites) {
      if (seen.has(w.url)) continue;
      seen.add(w.url);
      out.push({ url: w.url, source: 'website' });
    }
    for (const h of history ?? []) {
      if (seen.has(h.url)) continue;
      seen.add(h.url);
      out.push({ url: h.url, source: 'history' });
    }
    return out;
  }, [websites, history]);
}
