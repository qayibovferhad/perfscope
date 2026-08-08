import axios from 'axios';

let _getToken: () => string | null = () => null;
export function configureApiToken(getter: () => string | null) { _getToken = getter; }

export type UnauthorizedReason = 'expired' | 'invalid';

let _onUnauthorized: (reason: UnauthorizedReason) => void = () => {};
export function configureUnauthorizedHandler(fn: (reason: UnauthorizedReason) => void) {
  _onUnauthorized = fn;
}

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 90_000,
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
