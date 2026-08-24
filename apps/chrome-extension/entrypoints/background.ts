import { reconcileContentScript, syncContentScriptFor } from '../lib/tokenSync'

type ExtMessage =
  | { type: 'PERFSCOPE_TOKEN'; token: string; refreshToken?: string | null }
  | { type: 'PERFSCOPE_LOGOUT' }
  /** Sent by the settings drawer after saving a custom dashboard origin. */
  | { type: 'PERFSCOPE_WEB_URL'; webUrl: string }

export default defineBackground(() => {
  // A dynamic registration survives browser restarts, so it can outlive the setting that
  // created it. Reconciling on startup is what stops a stale one lingering.
  void reconcileContentScript()
  browser.runtime.onInstalled.addListener(() => { void reconcileContentScript() })

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const msg = message as ExtMessage
    switch (msg.type) {
      case 'PERFSCOPE_TOKEN':
        browser.storage.local
          .set({ token: msg.token, refreshToken: msg.refreshToken ?? null })
          .then(() => sendResponse({ ok: true }))
        break
      case 'PERFSCOPE_LOGOUT':
        browser.storage.local.remove(['token', 'refreshToken']).then(() => sendResponse({ ok: true }))
        break
      case 'PERFSCOPE_WEB_URL':
        syncContentScriptFor(msg.webUrl).then(() => sendResponse({ ok: true }))
        break
    }
    return true // keep the message channel open for the async sendResponse
  })
})
