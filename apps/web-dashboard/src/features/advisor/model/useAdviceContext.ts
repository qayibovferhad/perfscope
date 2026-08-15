import { useEffect } from 'react';
import { useAdvisorStore, type AdviceContext } from './advisorStore';

/**
 * Tell the advisor what this page is about.
 *
 * Call it from a page that has one subject — a site, a route — and the panel in the shell
 * switches from account-wide advice to advice about that. Cleared on unmount, so navigating
 * away puts the advisor back on the whole account rather than leaving it talking about a
 * page nobody is looking at.
 *
 * Pass `null` (or nothing) when the page's subject is not known yet; the panel simply stays
 * account-wide until it is.
 */
export function useAdviceContext(context: AdviceContext | null) {
  const setContext = useAdvisorStore((s) => s.setContext);

  // Depend on the fields rather than the object, so a page that rebuilds it every render
  // does not re-set the store on every render.
  const scope = context?.scope;
  const url   = context?.url;
  const label = context?.label;

  useEffect(() => {
    setContext(scope && url ? { scope, url, label: label ?? url } : null);
    return () => setContext(null);
  }, [scope, url, label, setContext]);
}
