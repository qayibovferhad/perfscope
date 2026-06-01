import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/entities/user';

interface AuthStore {
  user:    AuthUser | null;
  token:   string | null;
  setAuth: (user: AuthUser, token: string) => void;
  setUser: (user: AuthUser) => void;
  logout:  () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user:    null,
      token:   null,
      setAuth: (user, token) => set({ user, token }),
      setUser: (user)        => set({ user }),
      logout:  ()            => set({ user: null, token: null }),
    }),
    { name: 'perfscope-auth' },
  ),
);
