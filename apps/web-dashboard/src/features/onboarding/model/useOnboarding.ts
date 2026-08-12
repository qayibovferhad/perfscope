import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/shared/api/client';
import type { OnboardingStatus } from '@perfscope/shared';

/**
 * How far the account has got with setup, derived server-side from what it contains.
 *
 * Nothing is stored, so this is always the truth: a step completed through the CLI counts
 * exactly as much as one completed through the UI, and a step later undone reverts.
 */
export function useOnboarding() {
  return useQuery<OnboardingStatus>({
    queryKey: ['onboarding'],
    queryFn: () => fetchJson<OnboardingStatus>('/onboarding/status'),
    // Steps flip as the user works, and the query is a handful of counts.
    staleTime: 30_000,
    // Guidance must never look like a broken page — a failure just hides the panel.
    retry: false,
  });
}
