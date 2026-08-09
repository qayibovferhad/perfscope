import { io, type Socket } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3101';

let _getToken: () => string | null = () => null;
export function configureSocketToken(getter: () => string | null) { _getToken = getter; }

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = _getToken();
    socket = io(BACKEND_URL, {
      autoConnect: false,
      auth: token ? { token } : {},
    });
  }
  return socket;
}
