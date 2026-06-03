import { SCORE_GOOD, SCORE_WARN, SCORE_BAD } from '@/entities/analysis';

export const SCORE_MAP: Record<string, { card: string; text: string }> = {
  [SCORE_GOOD]: { card: 'bg-ps-healthy-muted border-ps-healthy-border', text: 'text-ps-healthy'    },
  [SCORE_WARN]: { card: 'bg-ps-amber-muted   border-ps-amber-border',   text: 'text-ps-amber'      },
  [SCORE_BAD]:  { card: 'bg-ps-reg-muted     border-ps-reg-border',     text: 'text-ps-regression' },
};

export type DeltaStatus = 'healthy' | 'accent' | 'warning' | 'danger';

export const STATUS_CLASSES: Record<DeltaStatus, string> = {
  healthy: 'bg-ps-healthy-muted border-ps-healthy-border text-ps-healthy',
  accent:  'bg-ps-accent-muted  border-ps-accent-border  text-ps-accent',
  warning: 'bg-ps-amber-muted   border-ps-amber-border   text-ps-amber',
  danger:  'bg-ps-reg-muted     border-ps-reg-border     text-ps-regression',
};

export const DELTAS: { label: string; delta: string; status: DeltaStatus }[] = [
  { label: 'Performance', delta: '+52 pts', status: 'healthy' },
  { label: 'CLS',         delta: '−82%',    status: 'accent'  },
  { label: 'LCP',         delta: '−75%',    status: 'warning' },
  { label: 'TBT',         delta: '−83%',    status: 'danger'  },
];
