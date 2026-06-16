const SCORE_MAP = [
  { min: 90, label: 'Excellent',  bg: 'var(--ps-healthy-muted)' },
  { min: 75, label: 'Good',       bg: 'var(--ps-healthy-muted)' },
  { min: 50, label: 'Needs Work', bg: 'var(--ps-amber-muted)'   },
  { min:  0, label: 'Poor',       bg: 'var(--ps-reg-muted)'     },
] as const;

function getScore(score: number) {
  return SCORE_MAP.find(({ min }) => score >= min) ?? SCORE_MAP[3];
}

export function scoreLabel(score: number) { return getScore(score).label; }
export function scoreBg(score: number)    { return getScore(score).bg;    }

export function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

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
