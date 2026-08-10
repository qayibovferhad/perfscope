import { fmtSec } from '@/shared/lib/format';

const SCORE_MAP = [
  { min: 90, label: 'Excellent',  bg: 'var(--ld-accent-soft)'    },
  { min: 75, label: 'Good',       bg: 'var(--ld-accent-soft)'    },
  { min: 50, label: 'Needs Work', bg: 'rgba(230,162,60,.10)'     },
  { min:  0, label: 'Poor',       bg: 'rgba(242,100,122,.09)'    },
] as const;

function getScore(score: number) {
  return SCORE_MAP.find(({ min }) => score >= min) ?? SCORE_MAP[3];
}

export function scoreLabel(score: number) { return getScore(score).label; }
export function scoreBg(score: number)    { return getScore(score).bg;    }

export const formatMs = fmtSec;

export function formatTbt(ms: number): string {
  return `${Math.round(ms)}ms`;
}

export function formatAuditDate(iso: string): string {
  const d    = new Date(iso);
  const now  = new Date();
  const prev = new Date(now);
  prev.setDate(now.getDate() - 1);
  const prefix =
    d.toDateString() === now.toDateString()  ? 'Today' :
    d.toDateString() === prev.toDateString() ? 'Yesterday' :
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${prefix} · ${timeAgo(iso)}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  );
}

export function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
