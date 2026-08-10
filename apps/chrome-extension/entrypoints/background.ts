type ExtMessage =
  | { type: 'PERFSCOPE_TOKEN'; token: string }
  | { type: 'PERFSCOPE_LOGOUT' }
  | { type: 'PERFSCOPE_EXT_CONFIG'; config: Record<string, unknown> }

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const msg = message as ExtMessage
    switch (msg.type) {
      case 'PERFSCOPE_TOKEN':
        browser.storage.local.set({ token: msg.token }).then(() => sendResponse({ ok: true }))
        break
      case 'PERFSCOPE_LOGOUT':
        browser.storage.local.remove('token').then(() => sendResponse({ ok: true }))
        break
      case 'PERFSCOPE_EXT_CONFIG':
        // Merge web-configured settings into extension storage
        browser.storage.local.set({ extConfig: msg.config }).then(() => sendResponse({ ok: true }))
        break
    }
    return true // keep the message channel open for the async sendResponse
  })
})
