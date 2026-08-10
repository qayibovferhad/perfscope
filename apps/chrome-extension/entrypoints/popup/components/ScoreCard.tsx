import { rateScore, RATING_COLOR } from '@perfscope/shared'

interface Props {
  label: string
  score: number
}

const COLOR = RATING_COLOR
// 0.40-alpha glow derived from the shared rating palette
const GLOW: Record<string, string> = {
  good:                `${RATING_COLOR.good}66`,
  'needs-improvement': `${RATING_COLOR['needs-improvement']}66`,
  poor:                `${RATING_COLOR.poor}66`,
}

const R = 20
const C = 2 * Math.PI * R

export function ScoreCard({ label, score }: Props) {
  const rating = rateScore(score)
  const color  = COLOR[rating]
  const glow   = GLOW[rating]
  const dash   = (score / 100) * C

  return (
    <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-ld-surface border border-ld-border">
      <div className="relative" style={{ width: 54, height: 54 }}>
        <svg width={54} height={54} viewBox="0 0 54 54" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={27} cy={27} r={R} fill="none" stroke="var(--ld-border-strong)" strokeWidth={4} />
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
      <span className="text-[10px] text-ld-text-3 text-center leading-tight font-medium">{label}</span>
    </div>
  )
}
