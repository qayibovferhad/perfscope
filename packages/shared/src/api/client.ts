import type { AnalysisResult } from '../types/analysis.js'
import type { WebsiteDoc }     from '../types/website.js'
import type { HistoryEntry }   from '../types/history.js'

export interface ApiClientConfig {
  baseUrl: string
  getToken: () => string | null | Promise<string | null>
}

/** Every response the API gives: `{ success: true, data }` or `{ success: false, error }`. */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

async function request<T>(
  config: ApiClientConfig,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await config.getToken()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  // One shape for every endpoint, so unwrapping happens here rather than at each caller.
  const body = await res.json() as ApiResponse<T>
  if (!body.success) throw new Error(body.error ?? 'Request failed')
  return body.data as T
}

export function createApiClient(config: ApiClientConfig) {
  return {
    async analyzeUrl(url: string): Promise<{ result: AnalysisResult; savedToHistory: boolean }> {
      return request<{ result: AnalysisResult; savedToHistory: boolean }>(config, '/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ url }),
      })
    },

    async getWebsites(): Promise<WebsiteDoc[]> {
      return request<WebsiteDoc[]>(config, '/api/websites')
    },

    async getUrlHistory(url: string): Promise<HistoryEntry[]> {
      return await request<HistoryEntry[]>(config, `/api/history?url=${encodeURIComponent(url)}`) ?? []
    },
  }
}

export type PerfScopeApiClient = ReturnType<typeof createApiClient>
