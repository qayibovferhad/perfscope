interface Props {
  label:          string
  yourLabel:      string
  competitorLabel: string
  yourValue:      number
  competitorValue: number
  /** 100 = full bar width */
  max:            number
  lowerIsBetter?: boolean
  formatValue:    (v: number) => string
}

export function MetricBar({
  label, yourLabel, competitorLabel,
  yourValue, competitorValue,
  max, lowerIsBetter = true, formatValue,
}: Props) {
  const yourPct       = Math.min((yourValue / max) * 100, 100)
  const competitorPct = Math.min((competitorValue / max) * 100, 100)
  const yourWins      = lowerIsBetter ? yourValue <= competitorValue : yourValue >= competitorValue

  const yourColor       = yourWins ? '#10b981' : '#ef4444'
  const competitorColor = !yourWins ? '#10b981' : '#ef4444'

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{label}</span>

      <Row label={yourLabel} pct={yourPct} color={yourColor} formatted={formatValue(yourValue)} />
      <Row label={competitorLabel} pct={competitorPct} color={competitorColor} formatted={formatValue(competitorValue)} />
    </div>
  )
}

function Row({ label, pct, color, formatted }: { label: string; pct: number; color: string; formatted: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 w-[60px] shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
        />
      </div>
      <span className="text-[10px] font-mono w-14 text-right shrink-0" style={{ color }}>{formatted}</span>
    </div>
  )
}
