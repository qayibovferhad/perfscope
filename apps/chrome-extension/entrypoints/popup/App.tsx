import { useState, useEffect } from 'react'
import { QuickAuditTab } from './tabs/QuickAuditTab'
import { CompareTab }    from './tabs/CompareTab'

type ActiveTab = 'quick-audit' | 'compare'

interface StorageState {
  token:      string | null
  backendUrl: string
}

const DEFAULT_BACKEND = 'http://localhost:3101'

export function App() {
  const [activeTab,    setActiveTab]    = useState<ActiveTab>('quick-audit')
  const [storage,      setStorage]      = useState<StorageState>({ token: null, backendUrl: DEFAULT_BACKEND })
  const [showSettings, setShowSettings] = useState(false)
  const [backendInput, setBackendInput] = useState(DEFAULT_BACKEND)

  useEffect(() => {
    browser.storage.local.get(['token', 'backendUrl']).then(result => {
      setStorage({
        token:      (result.token      as string | undefined) ?? null,
        backendUrl: (result.backendUrl as string | undefined) ?? DEFAULT_BACKEND,
      })
    })
  }, [])

  function openSettings() {
    setBackendInput(storage.backendUrl)
    setShowSettings(v => !v)
  }

  function saveSettings() {
    const url = backendInput.trim() || DEFAULT_BACKEND
    browser.storage.local.set({ backendUrl: url })
    setStorage(prev => ({ ...prev, backendUrl: url }))
    setShowSettings(false)
  }

  return (
    <div className="w-[380px] min-h-[480px] max-h-[600px] bg-slate-950 text-slate-200 flex flex-col overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800/70 shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black text-white shrink-0"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8B5CF6)', boxShadow: '0 0 10px rgba(139,92,246,0.45)' }}
          >
            PS
          </div>
          <span className="text-sm font-semibold text-slate-100 tracking-tight">PerfScope</span>
          <span className="text-[10px] text-slate-600 font-mono">Companion</span>
        </div>

        <div className="flex items-center gap-2">
          {storage.token && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              style={{ boxShadow: '0 0 5px rgba(52,211,153,0.8)' }}
              title="Connected to PerfScope"
            />
          )}
          <button
            onClick={openSettings}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            title="Settings"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      {/* ── Settings drawer ─────────────────────────────────────────── */}
      {showSettings && (
        <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 shrink-0">
          <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-2 font-semibold">Backend URL</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={backendInput}
              onChange={e => setBackendInput(e.target.value)}
              placeholder={DEFAULT_BACKEND}
              className="flex-1 text-xs bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors font-mono"
            />
            <button
              onClick={saveSettings}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
          {!storage.token && (
            <p className="text-[10px] text-amber-500/80 mt-2">
              Open PerfScope in a tab and log in — your token syncs automatically.
            </p>
          )}
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
              className="flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-200"
              style={active ? {
                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                color: '#fff',
                boxShadow: '0 0 14px rgba(99,102,241,0.38)',
              } : {
                color: '#64748b',
                background: 'transparent',
              }}
            >
              {tab === 'quick-audit' ? 'Quick Audit' : 'Compare'}
            </button>
          )
        })}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-3 overflow-y-auto">
        {activeTab === 'quick-audit' ? (
          <QuickAuditTab backendUrl={storage.backendUrl} token={storage.token} />
        ) : (
          <CompareTab backendUrl={storage.backendUrl} token={storage.token} />
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-t border-slate-800/60 shrink-0">
        <p className="text-[9px] text-slate-700 text-center font-mono">
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
