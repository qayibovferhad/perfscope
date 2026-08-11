import { Link } from 'react-router-dom';
import { ListChecks, CheckCircle2 } from 'lucide-react';
import type { OverviewAttention, OverviewAttentionReason } from '@perfscope/shared';
import { Panel, PanelHeader, PanelBody } from '@/shared/ui/panel';
import { scoreBand } from '@/entities/analysis';

/** Each reason states what is wrong, not what the field is called. */
const REASON_LABEL: Record<OverviewAttentionReason, string> = {
  breach:        'Budget broken',
  requiresLogin: 'Needs a login',
  lowScore:      'Scoring poorly',
  neverAudited:  'Never audited',
};

const REASON_TONE: Record<OverviewAttentionReason, string> = {
  breach:        'text-ld-rose',
  requiresLogin: 'text-ld-amber',
  lowScore:      'text-ld-amber',
  neverAudited:  'text-ld-text-3',
};

const BAND_TONE = {
  good: 'text-ld-accent',
  warn: 'text-ld-amber',
  poor: 'text-ld-rose',
} as const;

export function AttentionCard({ rows }: { rows: OverviewAttention[] }) {
  return (
    <Panel>
      <PanelHeader
        icon={<ListChecks />}
        title="Needs attention"
        meta={rows.length ? `${rows.length} site${rows.length === 1 ? '' : 's'}` : 'all healthy'}
      />

      <PanelBody>
        {!rows.length ? (
          <div className="flex items-start gap-[10px] py-[6px]">
            <CheckCircle2 className="w-[16px] h-[16px] text-ld-accent shrink-0 mt-[1px]" />
            <p className="text-[13px] text-ld-text-2 leading-[1.55]">
              Every tracked site is audited, scoring above 50 and within its budgets.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-[10px]">
            {rows.map((row) => (
              <li key={row.websiteId}>
                <Link
                  to={`/projects/${row.websiteId}`}
                  className="flex items-center gap-[14px] rounded-[13px] border border-ld-border bg-ld-surface-2 px-[16px] py-[14px] transition-[border-color,background-color] duration-200 hover:border-ld-accent-line hover:bg-ld-surface-hover"
                >
                  <span className="min-w-0 flex-1">
                    <b className="block text-[13.5px] font-bold text-ld-text tracking-tight truncate">
                      {row.name}
                    </b>
                    <span className={`block text-[11.5px] mt-[3px] font-semibold ${REASON_TONE[row.reason]}`}>
                      {REASON_LABEL[row.reason]}
                    </span>
                    {row.detail && (
                      <span className="block text-[11.5px] text-ld-text-3 mt-[3px] leading-[1.5] line-clamp-2">
                        {row.detail}
                      </span>
                    )}
                  </span>

                  <span className={`font-mono text-[20px] font-semibold tabular-nums shrink-0 w-[32px] text-right ${
                    row.score === null ? 'text-ld-text-3' : BAND_TONE[scoreBand(row.score)]
                  }`}>
                    {row.score ?? '—'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}
