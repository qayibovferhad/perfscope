import { useState, useEffect } from 'react'
import { PrimaryButton } from '../components/PrimaryButton'
import { useActiveTabUrl, hostnameOf, pathnameOf } from '../useActiveTab'
import { createApiClient, rateVital, RATING_COLOR, fmtSec, fmtMs, fmtCls, type ScoreRating } from '@perfscope/shared'
import type { AnalysisResult } from '@perfscope/shared'
import { ScoreCard }      from '../components/ScoreCard'
import { LoadingSpinner } from '../components/LoadingSpinner'

interface Props {
  backendUrl: string
  webUrl:     string
  token:      string | null
}


export function QuickAuditTab({ backendUrl, webUrl, token }: Props) {
  const currentUrl = useActiveTabUrl()
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState<AnalysisResult | null>(null)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  async function handleAnalyze() {
    if (!currentUrl) return
    setLoading(true)
    setError(null)
    setResult(null)
    setSaved(false)

    const api = createApiClient({ baseUrl: backendUrl, getToken: () => token })
    try {
      const { result: data, savedToHistory } = await api.analyzeUrl(currentUrl)
      setResult(data)
      if (savedToHistory) setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const hostname = hostnameOf(currentUrl)
  const route    = pathnameOf(currentUrl)

  return (
    <div className="flex flex-col gap-3">

      {/* URL breakdown */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ld-surface border border-ld-border">
          <span className="w-2 h-2 rounded-full bg-ld-accent-2 shrink-0 [box-shadow:0_0_6px_var(--ld-accent)]" />
          <span className="text-xs text-ld-text-2 font-mono truncate flex-1">{hostname || 'No active page'}</span>
          {route !== '/' && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-ld-accent-soft text-ld-accent border border-ld-accent-line shrink-0">
              {route}
            </span>
          )}
        </div>

        {/* Where it will be saved */}
        {token && hostname && (
          <p className="text-[10px] text-ld-text-3 px-1">
            Saved under <span className="text-ld-text-2">{hostname}</span>
            {route !== '/' && <> › <span className="text-ld-accent">{route}</span></>}
          </p>
        )}
      </div>

      {/* Analyze button */}
      <PrimaryButton
        onClick={handleAnalyze}
        disabled={!currentUrl || loading}
        loading={loading}
      >
        {loading
          ? <><LoadingSpinner size={16} /><span>Analyzing…</span></>
          : <><ChevronIcon /><span>Analyze Page</span></>
        }
      </PrimaryButton>

      {loading && (
        <p className="text-center text-[11px] text-ld-text-3">Running Lighthouse — up to 60 s.</p>
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg bg-[var(--ld-rose-soft)] border border-[var(--ld-rose-line)] text-xs text-ld-rose">
          {error}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ld-accent-soft border border-ld-accent-line text-xs text-ld-accent-2">
          <span>✓</span>
          <span>Saved to your PerfScope account</span>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-4 gap-1.5">
            <ScoreCard label="Perf"   score={result.scores.performance} />
            <ScoreCard label="A11y"   score={result.scores.accessibility} />
            <ScoreCard label="Best-P" score={result.scores.bestPractices} />
            <ScoreCard label="SEO"    score={result.scores.seo} />
          </div>

          <div className="flex flex-col gap-2 p-3 rounded-xl bg-ld-surface border border-ld-border">
            <span className="text-[10px] text-ld-text-3 uppercase tracking-widest font-semibold">Core Web Vitals</span>
            <div className="grid grid-cols-2 gap-1.5">
              <VitalChip label="LCP" value={fmtSec(result.metrics.lcp)} rating={rateVital('lcp', result.metrics.lcp)} />
              <VitalChip label="TBT" value={fmtMs(result.metrics.tbt)}  rating={rateVital('tbt', result.metrics.tbt)} />
              <VitalChip label="CLS" value={fmtCls(result.metrics.cls)} rating={rateVital('cls', result.metrics.cls)} />
              <VitalChip label="FCP" value={fmtSec(result.metrics.fcp)} rating={rateVital('fcp', result.metrics.fcp)} />
            </div>
          </div>

          <button
            onClick={() => browser.tabs.create({ url: `${webUrl}/history?open=${result.id}` })}
            className="text-[11px] text-ld-accent hover:text-ld-accent-2 underline underline-offset-2 text-center transition-colors"
          >
            View full report in PerfScope →
          </button>
        </div>
      )}
    </div>
  )
}

function VitalChip({ label, value, rating }: { label: string; value: string; rating: ScoreRating }) {
  const color = RATING_COLOR[rating]
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-ld-surface-2">
      <span className="text-[10px] text-ld-text-3 font-medium">{label}</span>
      <span className="text-xs font-mono font-semibold" style={{ color }}>{value}</span>
    </div>
  )
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13 17 18 12 13 7" />
      <polyline points="6 17 11 12 6 7" />
    </svg>
  )
}
