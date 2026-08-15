// Runs on PerfScope app pages (localhost:5173 / prod domain, plus any custom origin the
// background registers dynamically — see lib/tokenSync.ts).
//
// Syncs the JWT to browser.storage.local so the popup can make authenticated requests.
export default defineContentScript({
  matches: ['http://localhost:5173/*', 'https://perfscope.app/*'],
  runAt:   'document_idle',

  main() {
    syncToken()

    window.addEventListener('storage', (e) => {
      if (e.key === 'perfscope-auth') syncToken()
    })
  },
})

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
