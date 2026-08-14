import { useEffect, useMemo, useState } from 'react'
import { createApiClient } from '@perfscope/shared'

/**
 * The URL of the tab the popup was opened over, once the query resolves.
 *
 * Empty until then, and empty for anything that is not http(s) — a chrome:// page or the
 * new-tab page cannot be audited, and an empty string is what both tabs already treated
 * as "nothing to do".
 */
export function useActiveTabUrl(): string {
  const [url, setUrl] = useState('')

  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url?.startsWith('http')) setUrl(tab.url)
    })
  }, [])

  return url
}

/** Parsed hostname of a URL, or '' when it is empty or unparseable. */
export function hostnameOf(url: string): string {
  try { return new URL(url).hostname } catch { return '' }
}

/** Parsed path of a URL, falling back to '/' — what the UI shows as the route. */
export function pathnameOf(url: string): string {
  try { return new URL(url).pathname } catch { return '/' }
}

/**
 * The API client, stable for as long as its inputs are.
 *
 * CompareTab built one in its render body and then listed `[token, backendUrl]` as the
 * deps of an effect that closed over it — so the effect claimed a dependency on an object
 * that was new every render.
 */
export function useApiClient(backendUrl: string, token: string | null) {
  return useMemo(
    () => createApiClient({ baseUrl: backendUrl, getToken: () => token }),
    [backendUrl, token],
  )
}
