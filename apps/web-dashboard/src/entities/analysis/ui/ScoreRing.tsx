import { scoreBand, BAND_TEXT } from '../lib';

const CIRC = 2 * Math.PI * 25; // r=25 → ≈157.08

/** `none` is "never audited" — a hollow ring, not a zero. */
type RingStatus = 'good' | 'warn' | 'poor' | 'none';

const STROKE: Record<RingStatus, string> = {
  good: 'var(--ld-accent)',
  warn: 'var(--ld-amber)',
  poor: 'var(--ld-rose)',
  none: 'var(--ld-border-strong)',
};

const NUM_CLS: Record<RingStatus, string> = {
  good: BAND_TEXT.good,
  warn: BAND_TEXT.warn,
  poor: BAND_TEXT.poor,
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
  const status: RingStatus = score === null ? 'none' : scoreBand(score);
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
