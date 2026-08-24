import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/entities/user';

interface AuthStore {
  user:    AuthUser | null;
  /** Short-lived (30 minutes). Sent as the Bearer on every request. */
  token:   string | null;
  /**
   * Long-lived and revocable. Traded in at `/auth/refresh` when a request comes back 401,
   * which is what lets the access token be short enough to matter — see the api client.
   *
   * Null for a session signed in before this existed: those hold a 30-day access token that
   * keeps working until it lapses, and then the reader signs in once. Nobody is thrown out
   * by the upgrade.
   */
  refreshToken: string | null;
  /** The only way to sign in. There is deliberately no user-without-token setter: Google
   *  sign-in used one, and the session it produced 401'd on every request it ever made. */
  setAuth: (user: AuthUser, token: string, refreshToken?: string | null) => void;
  /** A silent renewal — same session, new pair. Never touches `user`, so a refresh racing
   *  a profile edit cannot put the old name back. */
  setTokens: (token: string, refreshToken: string) => void;
  logout:  () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user:    null,
      token:   null,
      refreshToken: null,
      setAuth: (user, token, refreshToken = null) => set({ user, token, refreshToken }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      logout:  ()            => set({ user: null, token: null, refreshToken: null }),
    }),
    {
      name: 'perfscope-auth',
      // Sessions saved by the old browser-only Google sign-in hold a user and no token.
      // They look signed in, 401 on every request, and never reach the unauthorized handler
      // (which needs a token to know a session died) — so the page sits there failing with
      // no way out but clearing site data. Treat one as signed out and show the login page.
      onRehydrateStorage: () => (state) => {
        if (state?.user && !state.token) state.logout();
      },
    },
  ),
);
