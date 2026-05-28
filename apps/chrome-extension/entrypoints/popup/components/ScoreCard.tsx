import { rateScore } from '@perfscope/shared'

interface Props {
  label: string
  score: number
}

const COLOR: Record<string, string> = {
  good:             '#10b981',
  'needs-improvement': '#F59E0B',
  poor:             '#ef4444',
}
const GLOW: Record<string, string> = {
  good:             'rgba(16,185,129,0.40)',
  'needs-improvement': 'rgba(245,158,11,0.40)',
  poor:             'rgba(239,68,68,0.40)',
}

const R = 20
const C = 2 * Math.PI * R

export function ScoreCard({ label, score }: Props) {
  const rating = rateScore(score)
  const color  = COLOR[rating]
  const glow   = GLOW[rating]
  const dash   = (score / 100) * C

  return (
    <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-slate-900/70 border border-slate-700/40">
      <div className="relative" style={{ width: 54, height: 54 }}>
        <svg width={54} height={54} viewBox="0 0 54 54" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={27} cy={27} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={4} />
          <circle
            cx={27} cy={27} r={R}
            fill="none"
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`}
            style={{ filter: `drop-shadow(0 0 5px ${glow})`, transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color }}>
          {score}
        </span>
      </div>
      <span className="text-[10px] text-slate-500 text-center leading-tight font-medium">{label}</span>
    </div>
  )
}
