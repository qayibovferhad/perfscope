import axios from 'axios';
import { useStorageStore } from '@/shared/model/storageStore';

let _getToken: () => string | null = () => null;
export function configureApiToken(getter: () => string | null) { _getToken = getter; }

export type UnauthorizedReason = 'expired' | 'invalid';

let _onUnauthorized: (reason: UnauthorizedReason) => void = () => {};
export function configureUnauthorizedHandler(fn: (reason: UnauthorizedReason) => void) {
  _onUnauthorized = fn;
}

/** Long enough for a cold Mongo read, short enough that a hung backend surfaces as an
 *  error instead of a spinner. Analysis itself runs over the socket, so nothing routed
 *  through here is long-running — the one exception (launching a browser for an
 *  auth-audit session) passes its own timeout at the call site. */
const DEFAULT_TIMEOUT_MS = 15_000;

/** Launching a visible Chrome and navigating it to the target genuinely takes tens of
 *  seconds. Exported so the call sites don't invent their own number. */
export const BROWSER_LAUNCH_TIMEOUT_MS = 60_000;

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = _getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Whether a failed request is worth trying again unprompted.
 *
 * The distinction the retry loop needs: a request that never got an answer (a restarting
 * server, a dropped connection, a timeout) will very likely succeed in a moment, while a
 * 4xx *is* the answer — the server is up and saying no, and re-asking it every few seconds
 * is a loop that never ends. 408 and 429 are the two that explicitly mean "later".
 */
export function isTransientError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === undefined) return true;
  return status >= 500 || status === 408 || status === 429;
}

/** Set by the backend on every response while it has no database. */
const STORAGE_HEADER = 'x-perfscope-storage';

/** Only meaningful when a response actually arrived: a network failure says nothing about
 *  the state of storage, and treating it as "fine" would clear a banner that still holds. */
function trackStorageState(res: { headers?: Record<string, unknown> } | undefined) {
  if (!res?.headers) return;
  useStorageStore.getState().setUnavailable(res.headers[STORAGE_HEADER] === 'unavailable');
}

apiClient.interceptors.response.use(
  (res) => {
    trackStorageState(res);
    return res;
  },
  (error) => {
    const status = error?.response?.status;
    const url    = error?.config?.url ?? '';
    trackStorageState(error?.response);

    // 401 on /auth/* means bad credentials on the login/register form itself —
    // those pages render their own error, so never treat it as a dead session.
    if (status === 401 && !url.startsWith('/auth')) {
      _onUnauthorized(error.response?.data?.code === 'TOKEN_EXPIRED' ? 'expired' : 'invalid');
    }
    return Promise.reject(error);
  },
);
