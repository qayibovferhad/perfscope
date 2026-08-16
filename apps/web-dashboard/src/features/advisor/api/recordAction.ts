import { apiClient } from '@/shared/api/client';
import type { AiAdviceAction } from '@perfscope/shared';

/**
 * Tells the backend a step's action link was clicked, so a later `getAdvice` call can
 * close the loop — "you said audit, they did, here's what moved" (see
 * `getActionOutcome` on the backend).
 *
 * Fire-and-forget: the click already navigates via `<Link>`, nothing on screen waits on
 * this, and a failed post here should never be the reason a step doesn't work.
 */
export function recordAdviceAction(action: AiAdviceAction): void {
  void apiClient.post('/advice/acted', { kind: action.kind, url: action.url }).catch(() => {});
}
