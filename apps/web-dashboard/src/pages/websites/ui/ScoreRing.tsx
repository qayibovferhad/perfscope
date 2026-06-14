const CIRC = 2 * Math.PI * 25; // r=25 → ≈157.08

function ringStatus(score: number | null): 'good' | 'warn' | 'poor' | 'none' {
  if (score === null) return 'none';
  if (score >= 90)    return 'good';
  if (score >= 50)    return 'warn';
  return 'poor';
}

const STROKE: Record<string, string> = {
  good: 'var(--ld-accent)',
  warn: 'var(--ld-amber)',
  poor: 'var(--ld-rose)',
  none: 'var(--ld-border-strong)',
};

const NUM_CLS: Record<string, string> = {
  good: 'text-ld-score-good',
  warn: 'text-ld-amber',
  poor: 'text-ld-rose',
  none: 'text-ld-text-3',
};

const SIZE_CLS: Record<number, string> = {
  44: 'w-[44px] h-[44px]',
  58: 'w-[58px] h-[58px]',
};

interface Props {
  score: number | null;
  size?: 44 | 58;
}

export function ScoreRing({ score, size = 58 }: Props) {
  const status  = ringStatus(score);
  const offset  = score === null ? CIRC : CIRC * (1 - score / 100);
  const sizeCls = SIZE_CLS[size] ?? SIZE_CLS[58];

  return (
    <div className={`relative shrink-0 ${sizeCls}`}>
      <svg className={`-rotate-90 ${sizeCls}`} viewBox="0 0 58 58">
        <circle cx="29" cy="29" r="25" fill="none" stroke="var(--ld-border)" strokeWidth="6" />
        <circle
          cx="29" cy="29" r="25"
          fill="none"
          stroke={STROKE[status]}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
        />
      </svg>
      <div className={`absolute inset-0 grid place-items-center font-mono font-semibold ${NUM_CLS[status]} ${score === null ? 'text-[13px]' : 'text-[17px]'}`}>
        {score === null ? '—' : score}
      </div>
    </div>
  );
}
