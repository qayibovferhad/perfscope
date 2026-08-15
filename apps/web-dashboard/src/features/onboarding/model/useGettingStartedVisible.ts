import { useOnboarding } from './useOnboarding';
import { isDismissed } from './dismissal';

/**
 * Whether the getting-started checklist is on screen.
 *
 * Exported so the dashboard can avoid stacking two "what to do next" blocks: during
 * onboarding the checklist is the better of the two — its steps are buttons that do the
 * thing — so the advisor's card stands down until it is finished or dismissed.
 */
export function useGettingStartedVisible(): boolean {
  const { data: status } = useOnboarding();
  return !!status && !status.complete && !isDismissed();
}
