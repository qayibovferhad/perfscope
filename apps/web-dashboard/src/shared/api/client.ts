import axios from 'axios';

let _getToken: () => string | null = () => null;
export function configureApiToken(getter: () => string | null) { _getToken = getter; }

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
