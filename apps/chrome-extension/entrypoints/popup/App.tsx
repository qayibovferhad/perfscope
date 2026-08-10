import { useState, useEffect } from 'react'
import { QuickAuditTab } from './tabs/QuickAuditTab'
import { CompareTab }    from './tabs/CompareTab'

type ActiveTab = 'quick-audit' | 'compare'

interface StorageState {
  token:      string | null
  backendUrl: string
  webUrl:     string
}

const DEFAULT_BACKEND = 'http://localhost:3101'
const DEFAULT_WEB     = 'http://localhost:5173'

/** Ask Chrome for host access to a custom backend origin. No-op when already granted. */
async function ensureHostPermission(url: string): Promise<boolean> {
  try {
    const origin = new URL(url).origin + '/*'
    const granted = await browser.permissions.contains({ origins: [origin] })
    if (granted) return true
    return await browser.permissions.request({ origins: [origin] })
  } catch {
    return false
  }
}

export function App() {
  const [activeTab,    setActiveTab]    = useState<ActiveTab>('quick-audit')
  const [storage,      setStorage]      = useState<StorageState>({ token: null, backendUrl: DEFAULT_BACKEND, webUrl: DEFAULT_WEB })
  const [showSettings, setShowSettings] = useState(false)
  const [backendInput, setBackendInput] = useState(DEFAULT_BACKEND)
  const [webInput,     setWebInput]     = useState(DEFAULT_WEB)
  const [permError,    setPermError]    = useState(false)

  useEffect(() => {
    browser.storage.local.get(['token', 'backendUrl', 'webUrl']).then(result => {
      setStorage({
        token:      (result.token      as string | undefined) ?? null,
        backendUrl: (result.backendUrl as string | undefined) ?? DEFAULT_BACKEND,
        webUrl:     (result.webUrl     as string | undefined) ?? DEFAULT_WEB,
      })
    })
  }, [])

  function openSettings() {
    setBackendInput(storage.backendUrl)
    setWebInput(storage.webUrl)
    setPermError(false)
    setShowSettings(v => !v)
  }

  async function saveSettings() {
    const backendUrl = backendInput.trim() || DEFAULT_BACKEND
    const webUrl     = webInput.trim()     || DEFAULT_WEB

    const ok = await ensureHostPermission(backendUrl)
    if (!ok) { setPermError(true); return }

    browser.storage.local.set({ backendUrl, webUrl })
    setStorage(prev => ({ ...prev, backendUrl, webUrl }))
    setShowSettings(false)
  }

  return (
    <div className="w-[380px] min-h-[480px] max-h-[600px] bg-ld-bg text-ld-text-2 flex flex-col overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-ld-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black text-[var(--ld-grad-text)] shrink-0 bg-[image:var(--ld-grad)] [box-shadow:0_0_10px_var(--ld-accent-line)]">
            PS
          </div>
          <span className="text-sm font-semibold text-ld-text tracking-tight">PerfScope</span>
          <span className="text-[10px] text-ld-text-3 font-mono">Companion</span>
        </div>

        <div className="flex items-center gap-2">
          {storage.token && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-ld-accent-2 [box-shadow:0_0_5px_var(--ld-accent)]"
              title="Connected to PerfScope"
            />
          )}
          <button
            onClick={openSettings}
            className="p-1.5 rounded-lg text-ld-text-3 hover:text-ld-text hover:bg-ld-surface-2 transition-colors"
            title="Settings"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      {/* ── Settings drawer ─────────────────────────────────────────── */}
      {showSettings && (
        <div className="px-4 py-3 bg-ld-surface border-b border-ld-border shrink-0 flex flex-col gap-3">
          <div>
            <p className="text-[10px] text-ld-text-3 uppercase tracking-widest mb-2 font-semibold">Backend URL</p>
            <input
              type="url"
              value={backendInput}
              onChange={e => setBackendInput(e.target.value)}
              placeholder={DEFAULT_BACKEND}
              className="w-full text-xs bg-ld-surface-2 border border-ld-border-strong rounded-lg px-3 py-1.5 text-ld-text placeholder:text-ld-text-3 outline-none focus:border-ld-accent-line transition-colors font-mono"
            />
          </div>
          <div>
            <p className="text-[10px] text-ld-text-3 uppercase tracking-widest mb-2 font-semibold">Web App URL</p>
            <input
              type="url"
              value={webInput}
              onChange={e => setWebInput(e.target.value)}
              placeholder={DEFAULT_WEB}
              className="w-full text-xs bg-ld-surface-2 border border-ld-border-strong rounded-lg px-3 py-1.5 text-ld-text placeholder:text-ld-text-3 outline-none focus:border-ld-accent-line transition-colors font-mono"
            />
          </div>
          <button
            onClick={saveSettings}
            className="self-end px-3 py-1.5 text-xs font-bold rounded-lg bg-[image:var(--ld-grad)] text-[var(--ld-grad-text)] hover:opacity-90 transition-opacity"
          >
            Save
          </button>
          {permError && (
            <p className="text-[10px] text-ld-rose -mt-1">
              Chrome permission for that backend origin was declined — the extension can't reach it without it.
            </p>
          )}
          {!storage.token && (
            <p className="text-[10px] text-ld-amber -mt-1">
              Open PerfScope in a tab and log in — your token syncs automatically.
            </p>
          )}
        </div>
      )}

      {/* ── Not connected banner ────────────────────────────────────── */}
      {!storage.token && (
        <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 shrink-0 bg-ld-accent-soft border border-ld-accent-line">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-ld-accent-2">Not connected</span>
            <span className="text-[10px] text-ld-text-3">Results won't be saved to your account</span>
          </div>
          <button
            onClick={() => browser.tabs.create({ url: `${storage.webUrl}/login` })}
            className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-[image:var(--ld-grad)] text-[var(--ld-grad-text)] hover:opacity-90 transition-opacity shrink-0"
          >
            Log in →
          </button>
        </div>
      )}

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div className="flex px-4 pt-3 gap-1.5 shrink-0">
        {(['quick-audit', 'compare'] as const).map(tab => {
          const active = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-200 ${
                active
                  ? 'bg-[image:var(--ld-grad)] text-[var(--ld-grad-text)] [box-shadow:0_0_14px_var(--ld-accent-line)]'
                  : 'text-ld-text-3 bg-transparent hover:text-ld-text-2'
              }`}
            >
              {tab === 'quick-audit' ? 'Quick Audit' : 'Compare'}
            </button>
          )
        })}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-3 overflow-y-auto">
        {activeTab === 'quick-audit' ? (
          <QuickAuditTab backendUrl={storage.backendUrl} webUrl={storage.webUrl} token={storage.token} />
        ) : (
          <CompareTab backendUrl={storage.backendUrl} token={storage.token} />
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-t border-ld-border shrink-0">
        <p className="text-[9px] text-ld-text-3 opacity-70 text-center font-mono">
          PerfScope Companion · v1.0.0
        </p>
      </div>
    </div>
  )
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
