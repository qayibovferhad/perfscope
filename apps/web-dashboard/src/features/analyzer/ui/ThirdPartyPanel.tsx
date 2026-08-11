import { Puzzle } from 'lucide-react';
import { Panel, PanelHeader } from '@/shared/ui/panel';
import { fmtMs, fmtBytes } from '@/shared/lib/format';
import type { ThirdPartyEntity } from '@/entities/analysis';

/** Above this, a vendor is holding up interaction badly enough to name it. */
const BLOCKING_WARN_MS = 100;

export function ThirdPartyPanel({ entities }: { entities: ThirdPartyEntity[] }) {
  if (entities.length === 0) return null;

  const totalBytes    = entities.reduce((sum, e) => sum + e.transferSize, 0);
  const totalBlocking = entities.reduce((sum, e) => sum + e.blockingTime, 0);
  // Bars are relative to the worst offender, so the comparison stays readable
  // whether the page loads one widget or twenty.
  const maxBytes      = Math.max(...entities.map(e => e.transferSize), 1);
  const maxBlocking   = Math.max(...entities.map(e => e.blockingTime), 1);

  return (
    <Panel>
      <PanelHeader
        icon={<Puzzle className="w-[15px] h-[15px]" />}
        title="Third parties"
        meta={`${entities.length} vendors · ${fmtBytes(totalBytes)} · ${fmtMs(totalBlocking)} blocking`}
      />

      <div className="px-[18px] pb-[16px]">
        <div className="grid grid-cols-[1fr_92px_1fr] gap-x-4 gap-y-[6px] items-center">
          <span className="font-mono text-[9.5px] uppercase tracking-[.12em] text-ld-text-3">Vendor</span>
          <span className="font-mono text-[9.5px] uppercase tracking-[.12em] text-ld-text-3 text-right">Transfer</span>
          <span className="font-mono text-[9.5px] uppercase tracking-[.12em] text-ld-text-3">Blocking the main thread</span>

          {entities.map((e) => {
            const heavy = e.blockingTime >= BLOCKING_WARN_MS;
            return (
              <div key={e.name} className="contents">
                <div className="min-w-0 py-[5px]">
                  <p className="text-[13px] text-ld-text truncate" title={e.name}>{e.name}</p>
                  <div className="h-[3px] mt-[4px] rounded-full bg-ld-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-ld-accent-line"
                      style={{ width: `${(e.transferSize / maxBytes) * 100}%` }}
                    />
                  </div>
                </div>

                <span className="font-mono text-[12px] text-ld-text-2 text-right tabular-nums">
                  {fmtBytes(e.transferSize)}
                </span>

                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex-1 h-[8px] rounded-full bg-ld-border overflow-hidden">
                    <div
                      className={`h-full rounded-full ${heavy ? 'bg-ld-rose' : 'bg-ld-amber'}`}
                      style={{ width: `${(e.blockingTime / maxBlocking) * 100}%` }}
                    />
                  </div>
                  <span className={`font-mono text-[12px] tabular-nums w-[62px] text-right ${heavy ? 'text-ld-rose' : 'text-ld-text-2'}`}>
                    {e.blockingTime > 0 ? fmtMs(e.blockingTime) : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11.5px] text-ld-text-3 mt-[14px] leading-[1.5]">
          Blocking time is the share of each vendor&apos;s main-thread work that delayed interaction.
          Deferring or self-hosting the heaviest entries usually pays off faster than optimising your own code.
        </p>
      </div>
    </Panel>
  );
}
