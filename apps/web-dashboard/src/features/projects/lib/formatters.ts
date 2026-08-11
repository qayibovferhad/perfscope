import { fmtSec } from '@/shared/lib/format';

// Lives in shared/lib now that the dashboard prints relative times too; re-exported
// so this module stays the one place the projects feature imports formatting from.
import { timeAgo } from '@/shared/lib/time';
export { timeAgo };

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

