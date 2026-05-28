import { useState, useEffect } from 'react'
import { createApiClient, rateLcp, rateCls, rateTbt } from '@perfscope/shared'
import type { AnalysisResult } from '@perfscope/shared'
import { ScoreCard }      from '../components/ScoreCard'
import { LoadingSpinner } from '../components/LoadingSpinner'

interface Props {
  backendUrl: string
  token:      string | null
}

const RATING_COLOR: Record<string, string> = {
  good:                '#10b981',
  'needs-improvement': '#F59E0B',
  poor:                '#ef4444',
}

export function QuickAuditTab({ backendUrl, token }: Props) {
  const [currentUrl, setCurrentUrl] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState<AnalysisResult | null>(null)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url?.startsWith('http')) setCurrentUrl(tab.url)
    })
  }, [])

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

  const parsed = (() => {
    try { return new URL(currentUrl) } catch { return null }
  })()

  const hostname = parsed?.hostname ?? ''
  const route    = parsed?.pathname ?? '/'

  return (
    <div className="flex flex-col gap-3">

      {/* URL breakdown */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.7)' }} />
          <span className="text-xs text-slate-300 font-mono truncate flex-1">{hostname || 'No active page'}</span>
          {route !== '/' && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 shrink-0">
              {route}
            </span>
          )}
        </div>

        {/* Where it will be saved */}
        {token && hostname && (
          <p className="text-[10px] text-slate-600 px-1">
            Saved under <span className="text-slate-500">{hostname}</span>
            {route !== '/' && <> › <span className="text-indigo-400">{route}</span></>}
          </p>
        )}
      </div>

      {/* Analyze button */}
      <button
        onClick={handleAnalyze}
        disabled={!currentUrl || loading}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: 'linear-gradient(135deg, #6366f1, #8B5CF6)',
          boxShadow:  loading ? 'none' : '0 0 18px rgba(139,92,246,0.40)',
        }}
      >
        {loading
          ? <><LoadingSpinner size={16} /><span>Analyzing…</span></>
          : <><ChevronIcon /><span>Analyze Page</span></>
        }
      </button>

      {loading && (
        <p className="text-center text-[11px] text-slate-600">Running Lighthouse — up to 60 s.</p>
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-xs text-red-400">
          {error}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400">
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

          <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">Core Web Vitals</span>
            <div className="grid grid-cols-2 gap-1.5">
              <VitalChip label="LCP" value={`${(result.metrics.lcp / 1000).toFixed(2)} s`} rating={rateLcp(result.metrics.lcp)} />
              <VitalChip label="TBT" value={`${Math.round(result.metrics.tbt)} ms`}         rating={rateTbt(result.metrics.tbt)} />
              <VitalChip label="CLS" value={result.metrics.cls.toFixed(3)}                   rating={rateCls(result.metrics.cls)} />
              <VitalChip label="FCP" value={`${(result.metrics.fcp / 1000).toFixed(2)} s`} rating={rateLcp(result.metrics.fcp)} />
            </div>
          </div>

          <button
            onClick={() => {
              const webUrl = backendUrl.replace('3101', '5173')
              browser.tabs.create({ url: `${webUrl}/history?open=${result.id}` })
            }}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2 text-center transition-colors"
          >
            View full report in PerfScope →
          </button>
        </div>
      )}
    </div>
  )
}

function VitalChip({ label, value, rating }: { label: string; value: string; rating: string }) {
  const color = RATING_COLOR[rating] ?? '#94a3b8'
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-800/60">
      <span className="text-[10px] text-slate-500 font-medium">{label}</span>
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
