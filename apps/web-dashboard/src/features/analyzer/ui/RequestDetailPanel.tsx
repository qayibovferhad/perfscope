import { X, ExternalLink } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { fmtMsOrDash as fmtMs, fmtBytesOrDash as fmtBytes } from '@/shared/lib/format';
import { RESOURCE_TYPES, resourceBadgeStyle } from '@/entities/analysis';
import type { NetworkRequest } from '@/entities/analysis';
import { resourceFilename } from '../lib/waterfall';

/**
 * The popover a waterfall row opens: every timing and size the request carries, plus the
 * TTFB/download split as a bar.
 *
 * Both waterfalls opened their own copy of this, ~75 lines each, identical down to the
 * order of the stats. The two had already parted on whether the bar was tinted by
 * resource type — it is here, because inside a popover there is no filmstrip beside it
 * to compete with, which was the only reason the rows go type-agnostic.
 */
export function RequestDetailPanel({ req, onClose }: { req: NetworkRequest; onClose: () => void }) {
  const cfg      = RESOURCE_TYPES[req.resourceType];
  const duration = req.endTime - req.startTime;
  const name     = resourceFilename(req.url);

  const stats = [
    { label: 'Start',     value: fmtMs(req.startTime),           mono: true },
    { label: 'End',       value: fmtMs(req.endTime),             mono: true },
    { label: 'Duration',  value: fmtMs(duration),                mono: true, bold: true },
    { label: 'TTFB',      value: fmtMs(req.ttfb),                mono: true },
    { label: 'Download',  value: fmtMs(req.contentDownloadTime), mono: true },
    { label: 'Transfer',  value: fmtBytes(req.transferSize),      mono: true, bold: true },
    { label: 'Resource',  value: fmtBytes(req.resourceSize),      mono: true },
    { label: 'MIME',      value: req.mimeType || '—',             mono: true },
    { label: 'Status',    value: req.statusCode ? String(req.statusCode) : '—', mono: true },
    { label: '3rd-party', value: req.isThirdParty ? 'Yes' : 'No' },
  ];

  return (
    <div className="absolute left-2 right-2 z-30 mt-0.5 rounded-[12px] border border-ld-border-strong bg-ld-surface-2 shadow-ld-shadow-card text-xs">
      <div className="flex items-start gap-2 px-3 py-2.5 border-b border-ld-border">
        <span
          className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border mt-0.5"
          style={resourceBadgeStyle(req.resourceType)}
        >
          {cfg.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ld-text truncate" title={name}>{name}</p>
          <a
            href={req.url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono text-ld-text-3 hover:text-ld-text truncate mt-0.5 transition-colors"
            title={req.url}
          >
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{req.url}</span>
          </a>
        </div>
        <button onClick={onClose} className="shrink-0 text-ld-text-3 hover:text-ld-text transition-colors cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-3 py-2.5">
        {stats.map(({ label, value, mono, bold }) => (
          <div key={label} className="flex justify-between items-center gap-2">
            <span className="text-ld-text-3 shrink-0">{label}</span>
            <span className={cn('text-ld-text-2 tabular-nums', mono && 'font-mono', bold && 'font-semibold text-ld-text')}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {duration > 0 && (
        <div className="px-3 pb-3 space-y-1">
          <div className="flex text-[9px] text-ld-text-3 justify-between">
            <span>TTFB ({fmtMs(req.ttfb)})</span>
            <span>Download ({fmtMs(req.contentDownloadTime)})</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-ld-border">
            <div
              className="rounded-l-full"
              style={{ width: `${Math.min((req.ttfb / duration) * 100, 100)}%`, backgroundColor: cfg.wait }}
            />
            <div className="rounded-r-full flex-1" style={{ backgroundColor: cfg.bar }} />
          </div>
        </div>
      )}
    </div>
  );
}
