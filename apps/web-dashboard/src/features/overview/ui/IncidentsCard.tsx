import { Link } from 'react-router-dom';
import { BellRing, Mail, Webhook, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import type { OverviewIncident } from '@perfscope/shared';
import { Panel, PanelHeader, PanelBody } from '@/shared/ui/panel';
import { cn } from '@/shared/lib/utils';
import { timeAgo } from '@/shared/lib/time';

/**
 * Alerts that fired and have not recovered.
 *
 * This is the first screen in the product to read `AlertLog` at all: the backend has
 * been recording every breach, every regression and every delivery attempt, and until
 * now none of it was visible anywhere. An alert you cannot look at is only half a
 * feature — the other half is answering "did it actually reach me?", which is why the
 * delivery line is given its own row rather than being tucked into the copy.
 */

const EVENT_LABEL: Record<string, string> = {
  'budget.breach':    'Budget broken',
  'audit.regression': 'Regression',
  'rum.breach':       'Field budget broken',
};

function DeliveryNote({ delivery }: { delivery: OverviewIncident['delivery'] }) {
  if (!delivery.length) {
    return (
      <span className="inline-flex items-center gap-[6px] text-[11.5px] font-medium text-ld-amber">
        <AlertTriangle className="w-[12px] h-[12px] shrink-0" />
        Recorded, but not sent — no channel configured
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-x-[12px] gap-y-[4px]">
      {delivery.map((d, i) => (
        <span
          key={`${d.channel}-${i}`}
          className={`inline-flex items-center gap-[6px] text-[11.5px] font-medium ${d.ok ? 'text-ld-accent' : 'text-ld-rose'}`}
        >
          {d.channel === 'email' ? <Mail className="w-[12px] h-[12px]" /> : <Webhook className="w-[12px] h-[12px]" />}
          {d.channel} {d.ok ? 'delivered' : 'failed'}
        </span>
      ))}
    </span>
  );
}

export function IncidentsCard({ incidents, className }: { incidents: OverviewIncident[]; className?: string }) {
  return (
    <Panel className={cn('flex flex-col', className)}>
      <PanelHeader
        icon={<BellRing />}
        title="Open alerts"
        meta={incidents.length ? `${incidents.length} firing` : 'all clear'}
      />

      {/* The list scrolls inside the panel rather than growing it: this card and the one
          beside it hold unrelated numbers of rows, and the taller one used to set a height
          the other could not fill, leaving a hole where a panel should be. */}
      <PanelBody className="flex-1 min-h-0 overflow-y-auto">
        {!incidents.length ? (
          <div className="flex items-start gap-[10px] py-[6px]">
            <CheckCircle2 className="w-[16px] h-[16px] text-ld-accent shrink-0 mt-[1px]" />
            <p className="text-[13px] text-ld-text-2 leading-[1.55]">
              Nothing is firing.{' '}
              <span className="text-ld-text-3">
                Budgets and regressions raise an alert here on the next run.
              </span>
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-[12px]">
            {incidents.map((incident) => (
              <li
                key={incident.id}
                className="rounded-[13px] border border-ld-border bg-ld-surface-2 px-[16px] py-[14px]"
              >
                <div className="flex items-start gap-[11px]">
                  <span className="mt-[6px] w-[8px] h-[8px] rounded-full bg-ld-rose shrink-0" />
                  <div className="min-w-0 flex-1">
                    <b className="block text-[13.5px] font-bold text-ld-text tracking-tight">
                      {EVENT_LABEL[incident.event] ?? incident.event}
                    </b>
                    <Link
                      to={`/projects/${incident.websiteId}`}
                      className="group inline-flex items-center gap-[5px] max-w-full text-[12px] text-ld-text-3 mt-[3px] transition-colors duration-150 hover:text-ld-accent"
                    >
                      <span className="truncate">{incident.url}</span>
                      <ArrowRight className="w-[12px] h-[12px] shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                    </Link>
                  </div>
                  <span className="font-mono text-[11px] text-ld-text-3 shrink-0 mt-[2px]">
                    {timeAgo(incident.at)}
                  </span>
                </div>

                {incident.lines.length > 0 && (
                  <ul className="mt-[11px] ml-[19px] flex flex-col gap-[4px] pl-[12px] border-l border-ld-border">
                    {incident.lines.map((line, i) => (
                      <li key={i} className="font-mono text-[11.5px] text-ld-text-2 leading-[1.5]">
                        {line}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-[12px] ml-[19px]">
                  <DeliveryNote delivery={incident.delivery} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}
