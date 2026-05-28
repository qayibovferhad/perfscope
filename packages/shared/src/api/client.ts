import type { AnalysisResult, WebsiteDoc, HistoryEntry } from '../types/analysis.js'

export interface ApiClientConfig {
  baseUrl: string
  getToken: () => string | null | Promise<string | null>
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  savedToHistory?: boolean
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

  return res.json() as Promise<T>
}

export function createApiClient(config: ApiClientConfig) {
  return {
    async analyzeUrl(url: string): Promise<{ result: AnalysisResult; savedToHistory: boolean }> {
      const json = await request<ApiResponse<AnalysisResult>>(config, '/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ url }),
      })
      if (!json.success || !json.data) throw new Error(json.error ?? 'Analysis failed')
      return { result: json.data, savedToHistory: json.savedToHistory ?? false }
    },

    async getWebsites(): Promise<WebsiteDoc[]> {
      return request<WebsiteDoc[]>(config, '/api/websites')
    },

    async getUrlHistory(url: string): Promise<HistoryEntry[]> {
      const json = await request<ApiResponse<HistoryEntry[]>>(
        config,
        `/api/history?url=${encodeURIComponent(url)}`,
      )
      return json.data ?? []
    },
  }
}

export type PerfScopeApiClient = ReturnType<typeof createApiClient>
