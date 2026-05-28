// Runs on PerfScope app pages (localhost:5173 / prod domain).
// Syncs JWT token and extension config to browser.storage.local so the
// popup can make authenticated requests and respect web-configured settings.
export default defineContentScript({
  matches: ['http://localhost:5173/*', 'https://perfscope.app/*'],
  runAt:   'document_idle',

  main() {
    syncAll()

    window.addEventListener('storage', (e) => {
      if (e.key === 'perfscope-auth' || e.key === 'perfscope-ext-config') syncAll()
    })
  },
})

function syncAll() {
  syncToken()
  syncExtConfig()
}

function syncToken() {
  try {
    const raw = localStorage.getItem('perfscope-auth')
    if (!raw) {
      browser.runtime.sendMessage({ type: 'PERFSCOPE_LOGOUT' }).catch(() => undefined)
      return
    }
    const parsed = JSON.parse(raw) as { state?: { token?: string | null } }
    const token  = parsed?.state?.token ?? null
    browser.runtime.sendMessage({
      type:  token ? 'PERFSCOPE_TOKEN' : 'PERFSCOPE_LOGOUT',
      token,
    }).catch(() => undefined)
  } catch { /* ignore */ }
}

function syncExtConfig() {
  try {
    const raw = localStorage.getItem('perfscope-ext-config')
    const cfg = raw ? JSON.parse(raw) as Record<string, unknown> : {}
    browser.runtime.sendMessage({ type: 'PERFSCOPE_EXT_CONFIG', config: cfg }).catch(() => undefined)
  } catch { /* ignore */ }
}
