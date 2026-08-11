import axios from 'axios';

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

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const url    = error?.config?.url ?? '';

    // 401 on /auth/* means bad credentials on the login/register form itself —
    // those pages render their own error, so never treat it as a dead session.
    if (status === 401 && !url.startsWith('/auth')) {
      _onUnauthorized(error.response?.data?.code === 'TOKEN_EXPIRED' ? 'expired' : 'invalid');
    }
    return Promise.reject(error);
  },
);
