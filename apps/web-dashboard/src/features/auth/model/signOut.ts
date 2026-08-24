import { apiClient } from '@/shared/api/client';
import { useAuthStore } from './authStore';

/**
 * Sign out — on the server as well as in this tab.
 *
 * Clearing the store used to be the whole of it, which meant the refresh token stayed valid
 * on the server for the rest of its month: signing out of a shared machine ended the
 * *appearance* of a session and not the session. This ends it, then clears.
 *
 * The request is not awaited by the caller's navigation and its failure is ignored on
 * purpose. A sign-out that can hang, or that can refuse, is one people stop trusting — and
 * the local half (which is what the person can see) must happen either way. The server side
 * is best-effort; an unreachable backend leaves a token that expires on its own.
 */
export function signOut(): void {
  const { refreshToken, logout } = useAuthStore.getState();

  if (refreshToken) {
    apiClient.post('/auth/logout', { refreshToken }).catch(() => { /* best effort */ });
  }
  logout();
}
