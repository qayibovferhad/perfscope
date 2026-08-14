import { io, type Socket } from 'socket.io-client';
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

/** A fresh, unconnected socket carrying the current auth token. */
export function createSocket(): AppSocket {
  const token = _getToken();
  return io(BACKEND_URL, {
    autoConnect: false,
    auth: token ? { token } : {},
  });
}

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) socket = createSocket();
  return socket;
}
