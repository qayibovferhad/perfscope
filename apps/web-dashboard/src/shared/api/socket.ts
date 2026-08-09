import { io, type Socket } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3101';

let _getToken: () => string | null = () => null;
export function configureSocketToken(getter: () => string | null) { _getToken = getter; }

/** A fresh, unconnected socket carrying the current auth token. */
export function createSocket(): Socket {
  const token = _getToken();
  return io(BACKEND_URL, {
    autoConnect: false,
    auth: token ? { token } : {},
  });
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) socket = createSocket();
  return socket;
}
