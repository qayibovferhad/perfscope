/**
 * Keeping the token sync working on a self-hosted dashboard.
 *
 * `content.ts` is declared statically for `localhost:5173` and `perfscope.app`, which is
 * where the dashboard lives for almost everyone. But the popup's settings drawer lets you
 * point the extension at any origin, and a statically declared content script cannot follow
 * it — so on a self-hosted dashboard the JWT never reached the extension and the popup sat
 * permanently logged out with no way to fix it from the UI.
 *
 * The fix is a *dynamically* registered copy of the same content script, re-registered
 * whenever the configured web URL changes. Chrome keeps dynamic registrations across
 * restarts, so this also has to reconcile on startup rather than blindly registering.
 */

/** Id of the dynamic registration. Stable, so re-registering replaces rather than stacks. */
const SCRIPT_ID = 'perfscope-token-sync'

/** Origins already covered by the static declaration in content.ts — never duplicate them. */
const STATIC_ORIGINS = ['http://localhost:5173', 'https://perfscope.app']

/** `https://example.com/app` → `https://example.com/*`, or null if it cannot be parsed. */
export function originPattern(url: string): string | null {
  try {
    return `${new URL(url).origin}/*`
  } catch {
    return null
  }
}

/** Whether content.ts already covers this origin without any dynamic registration. */
export function isStaticOrigin(url: string): boolean {
  try {
    return STATIC_ORIGINS.includes(new URL(url).origin)
  } catch {
    return false
  }
}

async function unregister(): Promise<void> {
  try {
    await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] })
  } catch {
    // Not registered. unregisterContentScripts rejects rather than no-ops on an unknown id.
  }
}

/**
 * Point the token sync at `webUrl`.
 *
 * Safe to call repeatedly and with the same value: it always clears the previous
 * registration first, so it converges rather than accumulating.
 */
export async function syncContentScriptFor(webUrl: string): Promise<void> {
  await unregister()

  const pattern = originPattern(webUrl)
  if (!pattern || isStaticOrigin(webUrl)) return

  // Without host permission Chrome rejects the registration outright. The popup asks for it
  // on Save; if it was declined, staying unregistered is the correct outcome.
  const granted = await browser.permissions.contains({ origins: [pattern] }).catch(() => false)
  if (!granted) return

  try {
    await browser.scripting.registerContentScripts([{
      id:             SCRIPT_ID,
      matches:        [pattern],
      js:             ['content-scripts/content.js'],
      runAt:          'document_idle',
      persistAcrossSessions: true,
    }])
  } catch (err) {
    console.warn('[PerfScope] Could not register token sync for', pattern, err)
  }
}

/**
 * Bring the registration in line with stored settings.
 *
 * Called on startup because `persistAcrossSessions` means a stale registration can outlive
 * the setting that created it — including one whose permission has since been revoked.
 */
export async function reconcileContentScript(): Promise<void> {
  const { webUrl } = await browser.storage.local.get('webUrl')
  if (typeof webUrl === 'string' && webUrl) await syncContentScriptFor(webUrl)
  else await unregister()
}
