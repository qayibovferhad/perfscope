import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthAuditStore {
  sessionId: string | null;
  setSession:   (id: string) => void;
  clearSession: () => void;
}

export const useAuthAuditStore = create<AuthAuditStore>()(
  persist(
    (set) => ({
      sessionId:    null,
      setSession:   (id) => set({ sessionId: id }),
      clearSession: ()   => set({ sessionId: null }),
    }),
    { name: 'perfscope-auth-audit' },
  ),
);
