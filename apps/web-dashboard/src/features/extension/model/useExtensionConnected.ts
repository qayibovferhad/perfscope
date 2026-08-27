import { useSyncExternalStore } from 'react';

const KEY = 'perfscope-auth';

/**
 * Whether the extension's token bridge has anything to sync — i.e. whether this browser
 * is signed in to the dashboard.
 *
 * `localStorage` is an external store, so it is read through the hook meant for one
 * rather than mirrored into state from an effect. That also removes the first frame the
 * effect version rendered as `null`: the answer is available synchronously.
 */
export function useExtensionConnected(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('storage', onChange);
      return () => window.removeEventListener('storage', onChange);
    },
    () => localStorage.getItem(KEY) !== null,
    // Server snapshot: this app never renders on a server, but the hook requires the
    // shape and "not connected" is the safe answer.
    () => false,
  );
}
