import type { WebsiteDoc } from '@perfscope/shared';

export function getHostname(url: string, fallback = url): string {
  try { return new URL(url).hostname; } catch { return fallback; }
}

/**
 * Whether a stored login session is still doing its job.
 *
 * `session` only records that cookies were captured once — it says nothing about whether
 * they still work. `requiresLogin` is set when a run carrying that session still landed
 * on a login screen, so the two together mean the session is dead. Reading `session`
 * alone is why three different screens were reporting "saved" for a session that had
 * already expired, next to a warning saying the opposite.
 */
export type SessionState = 'none' | 'active' | 'expired';

export function sessionState(site: Pick<WebsiteDoc, 'session' | 'requiresLogin'> | null | undefined): SessionState {
  if (!site?.session) return 'none';
  return site.requiresLogin ? 'expired' : 'active';
}
