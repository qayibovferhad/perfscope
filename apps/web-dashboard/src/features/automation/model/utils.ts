export function fmtDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function nextRunAt(scheduleTime: string): string {
  const [hh, mm] = scheduleTime.split(':').map(Number);
  const now  = new Date();
  const next = new Date();
  next.setHours(hh ?? 0, mm ?? 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
