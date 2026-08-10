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
        <span className="text-[10px] text-ld-text-3 uppercase tracking-widest font-semibold">Competitor (current page)</span>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ld-surface border border-[rgba(230,162,60,.3)]">
          <span className="w-2 h-2 rounded-full bg-ld-amber shrink-0 [box-shadow:0_0_6px_var(--ld-amber)]" />
          <span className="text-xs text-ld-text-2 truncate font-mono">{competitorHostname || '—'}</span>
        </div>
      </div>

      {/* Your site selector */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-ld-text-3 uppercase tracking-widest font-semibold">Your site</span>

        {noAuth ? (
          <p className="text-xs text-ld-amber py-1">
            Log in to PerfScope to see your sites.
          </p>
        ) : websitesErr ? (
          <p className="text-xs text-ld-rose py-1">{websitesErr}</p>
        ) : websites.length === 0 ? (
          <p className="text-xs text-ld-text-3 py-1">No websites found. Add one in PerfScope.</p>
        ) : (
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-ld-surface-2 border border-ld-border-strong rounded-lg text-ld-text outline-none focus:border-ld-accent-line transition-colors"
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
        className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-[var(--ld-grad-text)] bg-[image:var(--ld-grad)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${loading ? '' : '[box-shadow:0_0_16px_var(--ld-accent-line)]'}`}
      >
        {loading ? (
          <><LoadingSpinner size={16} /><span>Running analysis…</span></>
        ) : (
          <><ScalesIcon /><span>Compare</span></>
        )}
      </button>

      {loading && (
        <p className="text-center text-[11px] text-ld-text-3">
          Auditing competitor page — may take up to 60 s.
        </p>
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg bg-[rgba(242,100,122,.08)] border border-[rgba(242,100,122,.3)] text-xs text-ld-rose">
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
    <div className="flex flex-col gap-3 p-3 rounded-xl bg-ld-surface border border-ld-border">
      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px]">
        <LegendDot color="var(--ld-accent)" label={`You — ${yourLabel}`} />
        <LegendDot color="var(--ld-amber)" label={`Them — ${competitorLabel}`} />
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

      <div className="h-px bg-ld-border my-0.5" />

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
      <span className="text-ld-text-3 truncate max-w-[120px]">{label}</span>
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
