import { Link } from 'react-router-dom';
import { Activity, AlertTriangle } from 'lucide-react';
import type { OverviewRum } from '@perfscope/shared';
import { Panel, PanelHeader, PanelBody } from '@/shared/ui/panel';
import { cn } from '@/shared/lib/utils';

/**
 * Whether the snippet is actually reporting.
 *
 * A key issued and a key installed look identical from the server's side until a beacon
 * arrives, so "3 installed, 0 reporting" is the state worth surfacing — it means the
 * snippet was generated and then never pasted into the site.
 */
export function RumPulseCard({ rum, className }: { rum: OverviewRum | null; className?: string }) {
  return (
    <Panel className={cn('flex flex-col', className)}>
      <PanelHeader icon={<Activity />} title="Field data · your visitors" meta="last 24h" />

      {/* Centred: this card is two lines beside a list of eight, and pinning them to the
          top of a shared row height left the number floating above a field of nothing. */}
      <PanelBody className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-center gap-[12px]">
        {!rum ? (
          <p className="text-[13px] text-ld-text-2 leading-[1.6]">
            No RUM snippet installed. Lab runs measure your server; the snippet measures
            your users — including pages behind a login.{' '}
            <Link to="/websites" className="font-semibold text-ld-accent hover:underline">
              Get the snippet
            </Link>
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-[11px]">
              <b className="font-mono text-[30px] font-semibold tracking-[-0.03em] text-ld-text leading-none tabular-nums">
                {rum.pageViews24h.toLocaleString()}
              </b>
              <span className="text-[13px] text-ld-text-3">
                page view{rum.pageViews24h === 1 ? '' : 's'} from {rum.sitesReporting} of{' '}
                {rum.sitesInstalled} installed site{rum.sitesInstalled === 1 ? '' : 's'}
              </span>
            </div>

            {rum.sitesReporting === 0 && (
              <p className="flex items-start gap-[8px] text-[12px] text-ld-amber leading-[1.5] rounded-[10px] border border-ld-amber-line bg-ld-amber-wash px-[12px] py-[10px]">
                <AlertTriangle className="w-[13px] h-[13px] shrink-0 mt-[2px]" />
                A key was issued but nothing has arrived — the snippet is probably not on
                the page yet.
              </p>
            )}
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
