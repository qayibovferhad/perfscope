import { Database } from 'lucide-react';
import { useStorageStore } from '@/shared/model/storageStore';

/**
 * Shown while the backend is running without its database.
 *
 * Every list is legitimately empty in that state, so the pages below render their ordinary
 * "nothing yet" copy — which on its own would read as a statement about the account. This
 * strip is the missing half of that sentence, and it is deliberately a notice rather than
 * an error: audits still run, they simply are not recorded.
 */
export function StorageBanner() {
  const unavailable = useStorageStore(s => s.unavailable);
  if (!unavailable) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-[10px] px-[clamp(22px,4vw,48px)] py-[10px] shrink-0
                 border-b border-ld-border bg-ld-surface-2 text-[13px] text-ld-text-2"
    >
      <Database className="w-[15px] h-[15px] mt-[2px] shrink-0 text-ld-amber" />
      <p>
        <b className="font-semibold text-ld-text">Storage is offline.</b>{' '}
        Audits still run, but nothing is being saved and every list here reads as empty —
        this is not your data. Start MongoDB (<code className="font-mono text-[12px]">docker compose up -d</code>)
        and it reconnects on its own.
      </p>
    </div>
  );
}
