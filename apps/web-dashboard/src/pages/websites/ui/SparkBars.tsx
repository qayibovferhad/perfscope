interface Props { scores: number[]; }

export function SparkBars({ scores }: Props) {
  if (!scores.length) return null;
  const max = Math.max(...scores);

  return (
    <div className="ml-auto flex items-end gap-[3px] h-[26px] shrink-0">
      {scores.map((s, i) => {
        const heightPct = max > 0 ? Math.round((s / max) * 100) : 0;
        const isDim = i > 0 && s < scores[i - 1];
        return (
          <span
            key={i}
            className={`w-[5px] rounded-sm block transition-colors h-[var(--bar-h)] group-hover:bg-ld-accent
                        ${isDim ? 'bg-ld-border-strong' : 'bg-ld-accent-line'}`}
            style={{ '--bar-h': `${Math.max(heightPct, 8)}%` } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}
