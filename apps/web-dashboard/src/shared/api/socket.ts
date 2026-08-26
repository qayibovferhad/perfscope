import { io, type Socket } from 'socket.io-client';
import { hmrSingleton } from '@/shared/lib/hmrSingleton';
import { activeTeamId } from '@/shared/model/teamStore';
import type { ServerToClientEvents, ClientToServerEvents } from '@perfscope/shared';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3101';

/**
 * The socket, carrying the contract from @perfscope/shared so event names and payloads
 * are checked instead of being string literals both ends happened to agree on.
 *
 * Note the argument order: both ends put the events they *listen* for first, so this is
 * the mirror of the server's `Server<ClientToServerEvents, ServerToClientEvents>` in
 * app.ts. Swapping them still compiles every emit and fails only on the listeners.
 *
 * `io()` in socket.io-client v4 takes no type arguments — it returns a `Socket` on the
 * permissive DefaultEventsMap, which assigns to this alias. The narrowing happens at the
 * return annotations below, and it does bite: a typo in an event name is a compile error
 * at every emit and every listener.
 */
export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let _getToken: () => string | null = () => null;
export function configureSocketToken(getter: () => string | null) { _getToken = getter; }

/**
 * A fresh, unconnected socket carrying the current auth token — and the team it is working
 * in, because an audit a member starts belongs to the account they are looking at. A socket
 * has no per-message headers, so the handshake is the only place this can be said, which is
 * also why switching teams has to build a new one (`resetSocket`).
 */
export function createSocket(): AppSocket {
  const token  = _getToken();
  const teamId = activeTeamId();
  return io(BACKEND_URL, {
    autoConnect: false,
    auth: { ...(token ? { token } : {}), ...(teamId ? { teamId } : {}) },
  });
}

/**
 * The shared socket. Held per *tab* rather than per module instance: a hot reload of this
 * file used to leave the old socket connected with all its listeners while the new copy
 * opened a second one, so every analysis event was handled twice by two generations of
 * the same code.
 */
export function getSocket(): AppSocket {
  return hmrSingleton('socket', () => createSocket());
}

/**
 * Drop the shared socket so the next `getSocket()` builds one.
 *
 * Switching teams changes the handshake, and a live connection cannot be re-handshaken —
 * it would keep running as the previous account, storing that account's audits. Called by
 * the team switcher, right before it clears the query cache.
 */
export function resetSocket(): void {
  const existing = (globalThis as Record<string, unknown>)['__perfscope_singletons__'] as
    Record<string, unknown> | undefined;
  const socket = existing?.['socket'] as AppSocket | undefined;
  socket?.removeAllListeners();
  socket?.disconnect();
  if (existing) delete existing['socket'];
}

// ─── Dev only ────────────────────────────────────────────────────────────────
// This module holds live state — a socket, a store, or the listeners that keep them in
// step. Vite's default hot update evaluates a *new copy* and leaves the old one running,
// so the tab ends up with two of everything: one set answering events, another rendering
// the screen. That is invisible until something like Stop stops working, and then it
// costs hours, because a fresh tab behaves perfectly and the reporter's does not.
//
// So changes here force a full reload instead. Slower to develop against, and honest.
if (import.meta.hot) import.meta.hot.accept(() => import.meta.hot?.invalidate());
