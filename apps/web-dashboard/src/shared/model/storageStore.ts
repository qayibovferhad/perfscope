import { create } from 'zustand';

/**
 * Whether the backend currently has its database.
 *
 * MONGODB_URI is optional — the app runs without it and simply stores nothing. The read
 * endpoints therefore answer with empty lists in that state rather than failing, which is
 * what keeps every page on its ordinary empty state. That leaves one thing unsaid, and it
 * is the important one: "no websites yet" is then not a fact about the account. The
 * backend marks those responses with a header (`X-Perfscope-Storage: unavailable`) and
 * this store carries it to the one banner that explains it.
 */
interface StorageState {
  unavailable: boolean;
  setUnavailable: (value: boolean) => void;
}

export const useStorageStore = create<StorageState>((set) => ({
  unavailable: false,
  setUnavailable: (value) =>
    // Guarded so the flood of ordinary responses does not re-render the shell.
    set((s) => (s.unavailable === value ? s : { unavailable: value })),
}));
