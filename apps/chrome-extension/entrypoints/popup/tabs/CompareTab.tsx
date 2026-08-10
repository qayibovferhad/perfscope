import { useState, useEffect } from 'react'
import { createApiClient, fmtSec, fmtMs, fmtCls } from '@perfscope/shared'
import type { AnalysisResult, WebsiteDoc, HistoryEntry } from '@perfscope/shared'
import { MetricBar } from '../components/MetricBar'
import { LoadingSpinner } from '../components/LoadingSpinner'

interface Props {
  backendUrl: string
  token:      string | null
}

interface CompareState {
  competitor: AnalysisResult
  yours:      HistoryEntry
  yourSite:   WebsiteDoc
}

export function CompareTab({ backendUrl, token }: Props) {
  const [currentUrl,   setCurrentUrl]   = useState('')
  const [websites,     setWebsites]     = useState<WebsiteDoc[]>([])
  const [selectedId,   setSelectedId]   = useState('')
  const [websitesErr,  setWebsitesErr]  = useState<string | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [compareResult, setCompareResult] = useState<CompareState | null>(null)
  const [error,        setError]        = useState<string | null>(null)

  const api = createApiClient({ baseUrl: backendUrl, getToken: () => token })

  // Get active tab URL
  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url?.startsWith('http')) setCurrentUrl(tab.url)
    })
  }, [])

  // Fetch user's websites (requires auth)
  useEffect(() => {
    if (!token) return
    api.getWebsites()
      .then((sites) => { setWebsites(sites); if (sites[0]) setSelectedId(sites[0]._id) })
      .catch((err: Error) => setWebsitesErr(err.message))
  }, [token, backendUrl])

  async function handleCompare() {
    const yourSite = websites.find(w => w._id === selectedId)
    if (!currentUrl || !yourSite) return

    setLoading(true)
    setError(null)
    setCompareResult(null)

    try {
      // Run competitor analysis + fetch your site's latest history in parallel
      const [{ result: competitor }, history] = await Promise.all([
        api.analyzeUrl(currentUrl),
        api.getUrlHistory(yourSite.url),
      ])

      if (!history.length) {
        throw new Error(`No audit history found for ${yourSite.url}. Run an audit in PerfScope first.`)
      }

      setCompareResult({ competitor, yours: history[0], yourSite })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  const competitorHostname = (() => {
    try { return new URL(currentUrl).hostname } catch { return currentUrl }
  })()

  const noAuth = !token

  return (
    <div className="flex flex-col gap-3">
      {/* Target URL */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">Competitor (current page)</span>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-amber-500/25">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" style={{ boxShadow: '0 0 6px rgba(245,158,11,0.7)' }} />
          <span className="text-xs text-slate-300 truncate font-mono">{competitorHostname || '—'}</span>
        </div>
      </div>

      {/* Your site selector */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">Your site</span>

        {noAuth ? (
          <p className="text-xs text-amber-400/80 py-1">
            Log in to PerfScope to see your sites.
          </p>
        ) : websitesErr ? (
          <p className="text-xs text-red-400 py-1">{websitesErr}</p>
        ) : websites.length === 0 ? (
          <p className="text-xs text-slate-600 py-1">No websites found. Add one in PerfScope.</p>
        ) : (
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none focus:border-indigo-500 transition-colors"
          >
            {websites.map(site => (
              <option key={site._id} value={site._id}>
                {site.name || site.url}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Compare button */}
      <button
        onClick={handleCompare}
        disabled={!currentUrl || !selectedId || loading || noAuth}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
          boxShadow:  loading ? 'none' : '0 0 16px rgba(99,102,241,0.35)',
        }}
      >
        {loading ? (
          <><LoadingSpinner size={16} /><span>Running analysis…</span></>
        ) : (
          <><ScalesIcon /><span>Compare</span></>
        )}
      </button>

      {loading && (
        <p className="text-center text-[11px] text-slate-600">
          Auditing competitor page — may take up to 60 s.
        </p>
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Comparison results */}
      {compareResult && (
        <CompareResults state={compareResult} competitorHostname={competitorHostname} />
      )}
    </div>
  )
}

// ─── Results panel ────────────────────────────────────────────────────────────

function CompareResults({ state, competitorHostname }: { state: CompareState; competitorHostname: string }) {
  const { competitor, yours, yourSite } = state
  const yourLabel       = yourSite.name || new URL(yourSite.url).hostname
  const competitorLabel = competitorHostname

  return (
    <div className="flex flex-col gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px]">
        <LegendDot color="#6366f1" label={`You — ${yourLabel}`} />
        <LegendDot color="#F59E0B" label={`Them — ${competitorLabel}`} />
      </div>

      {/* Score bars */}
      <div className="flex flex-col gap-2.5">
        <ScoreBar
          label="Performance"
          yourScore={yours.scores.performance}
          competitorScore={competitor.scores.performance}
          yourLabel={yourLabel}
          competitorLabel={competitorLabel}
        />
        <ScoreBar
          label="Accessibility"
          yourScore={yours.scores.accessibility}
          competitorScore={competitor.scores.accessibility}
          yourLabel={yourLabel}
          competitorLabel={competitorLabel}
        />
        <ScoreBar
          label="SEO"
          yourScore={yours.scores.seo}
          competitorScore={competitor.scores.seo}
          yourLabel={yourLabel}
          competitorLabel={competitorLabel}
        />
      </div>

      <div className="h-px bg-slate-800 my-0.5" />

      {/* Web Vitals bars */}
      <div className="flex flex-col gap-2.5">
        <MetricBar
          label="LCP"
          yourLabel={yourLabel}
          competitorLabel={competitorLabel}
          yourValue={yours.metrics.lcp}
          competitorValue={competitor.metrics.lcp}
          max={8000}
          lowerIsBetter
          formatValue={fmtSec}
        />
        <MetricBar
          label="TBT"
          yourLabel={yourLabel}
          competitorLabel={competitorLabel}
          yourValue={yours.metrics.tbt}
          competitorValue={competitor.metrics.tbt}
          max={1500}
          lowerIsBetter
          formatValue={fmtMs}
        />
        <MetricBar
          label="CLS"
          yourLabel={yourLabel}
          competitorLabel={competitorLabel}
          yourValue={yours.metrics.cls}
          competitorValue={competitor.metrics.cls}
          max={0.5}
          lowerIsBetter
          formatValue={fmtCls}
        />
      </div>
    </div>
  )
}

function ScoreBar({
  label, yourScore, competitorScore, yourLabel, competitorLabel,
}: {
  label:           string
  yourScore:       number
  competitorScore: number
  yourLabel:       string
  competitorLabel: string
}) {
  return (
    <MetricBar
      label={label}
      yourLabel={yourLabel}
      competitorLabel={competitorLabel}
      yourValue={yourScore}
      competitorValue={competitorScore}
      max={100}
      lowerIsBetter={false}
      formatValue={v => `${v}`}
    />
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-slate-500 truncate max-w-[120px]">{label}</span>
    </div>
  )
}

function ScalesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3" x2="12" y2="21" />
      <path d="M3 9l4-4 4 4M17 15l4 4-4 4" />
      <path d="M3 9h8M13 15h8" />
    </svg>
  )
}
