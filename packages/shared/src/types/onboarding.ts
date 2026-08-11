/**
 * Setup progress, derived from what the account actually contains.
 *
 * Nothing here is stored: a step is done because the data that proves it exists, so the
 * checklist cannot drift from reality, cannot be wrong after an import, and needs no
 * migration when the steps change.
 */

export type OnboardingStepId =
  | 'website'
  | 'audit'
  | 'automation'
  | 'budget'
  | 'rum'

export interface OnboardingStatus {
  /** Per-step completion, keyed by step id. */
  steps: Record<OnboardingStepId, boolean>
  /** Convenience counts the panel shows as evidence ("2 sites, 14 audits"). */
  counts: {
    websites: number
    audits:   number
    rumPageViews: number
  }
  /** True once every step is done — the panel retires itself. */
  complete: boolean
}
