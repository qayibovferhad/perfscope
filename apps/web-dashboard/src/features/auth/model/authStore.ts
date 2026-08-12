import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/entities/user';

interface AuthStore {
  user:    AuthUser | null;
  token:   string | null;
  /** The only way to sign in. There is deliberately no user-without-token setter: Google
   *  sign-in used one, and the session it produced 401'd on every request it ever made. */
  setAuth: (user: AuthUser, token: string) => void;
  logout:  () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user:    null,
      token:   null,
      setAuth: (user, token) => set({ user, token }),
      logout:  ()            => set({ user: null, token: null }),
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
