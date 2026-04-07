import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 90_000, // 90s — Lighthouse audits can take 30s+
  headers: { 'Content-Type': 'application/json' },
});
