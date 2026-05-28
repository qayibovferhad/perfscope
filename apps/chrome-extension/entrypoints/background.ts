export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'PERFSCOPE_TOKEN') {
      browser.storage.local.set({ token: message.token }).then(() => sendResponse({ ok: true }))
      return true
    }
    if (message.type === 'PERFSCOPE_LOGOUT') {
      browser.storage.local.remove('token').then(() => sendResponse({ ok: true }))
      return true
    }
    if (message.type === 'PERFSCOPE_EXT_CONFIG') {
      // Merge web-configured settings into extension storage
      browser.storage.local.set({ extConfig: message.config }).then(() => sendResponse({ ok: true }))
      return true
    }
  })
})
