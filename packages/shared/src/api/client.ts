import type { AnalysisResult } from '../types/analysis.js'
import type { WebsiteDoc }     from '../types/website.js'
import type { HistoryEntry }   from '../types/history.js'

export interface ApiClientConfig {
  baseUrl: string
  getToken: () => string | null | Promise<string | null>
  /**
   * The refresh token, when the caller keeps one.
   *
   * Access tokens live thirty minutes, so a client that stores one and nothing else is a
   * client that stops working half an hour after sign-in. Supplying these two makes a 401
   * a renewal instead of a dead end; leaving them out keeps the old behaviour exactly.
   */
  getRefreshToken?: () => string | null | Promise<string | null>
  /** Called with the new pair so the caller can persist it. Refresh tokens rotate — losing
   *  the successor strands the session. */
  onTokensRefreshed?: (tokens: { token: string; refreshToken: string }) => void | Promise<void>
}

/** Every response the API gives: `{ success: true, data }` or `{ success: false, error }`. */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Trade the stored refresh token for a new pair, once.
 *
 * Kept per config object rather than per module: two clients pointed at two backends must
 * not share a renewal. The promise is what stops a popup that fires three requests at once
 * from spending the refresh token three times — and since refresh tokens rotate, two of
 * those would be *reuse*, which the server reads as theft and answers by ending the session.
 */
const renewals = new WeakMap<ApiClientConfig, Promise<string | null>>()

async function renew(config: ApiClientConfig): Promise<string | null> {
  if (!config.getRefreshToken) return null

  const existing = renewals.get(config)
  if (existing) return existing

  const attempt = (async () => {
    try {
      const refreshToken = await config.getRefreshToken!()
      if (!refreshToken) return null

      const res = await fetch(`${config.baseUrl}/api/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken }),
      })
      if (!res.ok) return null

      const body = await res.json() as ApiResponse<{ token: string; refreshToken: string }>
      const tokens = body.data
      if (!body.success || !tokens?.token || !tokens.refreshToken) return null

      await config.onTokensRefreshed?.(tokens)
      return tokens.token
    } catch {
      return null
    } finally {
      renewals.delete(config)
    }
  })()

  renewals.set(config, attempt)
  return attempt
}

async function request<T>(
  config: ApiClientConfig,
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const token = await config.getToken()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  })

  // An expired access token is the ordinary state of a client that has been idle, not a
  // dead session: renew once and replay. A second 401 is the real answer.
  if (res.status === 401 && !retried) {
    const renewed = await renew(config)
    if (renewed) {
      return request<T>({ ...config, getToken: () => renewed }, path, options, true)
    }
  }

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
