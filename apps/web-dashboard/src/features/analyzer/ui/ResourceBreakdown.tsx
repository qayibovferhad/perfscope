import { motion } from 'framer-motion';
import {
  FileCode2, Palette, ImageIcon, Type, Globe,
  ExternalLink, AlertTriangle, LayoutGrid,
} from 'lucide-react';
import { Panel, PanelHeader } from '@/shared/ui/panel';
import { InfoTip } from '@/shared/ui/info-tip';
import { cn } from '@/shared/lib/utils';
import type { ParsedResources, ResourceType, NetworkRequest } from '@/entities/analysis';
import { fmtBytes } from '@/shared/lib/format';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.min(100, Math.round((part / total) * 100));
}

function filename(url: string): string {
  try {
    const path = new URL(url).pathname;
    return path.split('/').pop() || path;
  } catch {
    return url;
  }
}

// ─── Size colour indicator ────────────────────────────────────────────────────

const SIZE_THRESHOLDS: Partial<Record<ResourceType, [number, number]>> = {
  script:     [100 * 1024, 500 * 1024],
  stylesheet: [50  * 1024, 150 * 1024],
  image:      [200 * 1024, 1024 * 1024],
  font:       [50  * 1024, 200 * 1024],
  media:      [1024 * 1024, 5 * 1024 * 1024],
};

function sizeColor(req: NetworkRequest): { dot: string; text: string } {
  const thresholds = SIZE_THRESHOLDS[req.resourceType];
  if (!thresholds) return { dot: 'bg-ld-text-3',  text: 'text-ld-text-3'  };
  const [warn, crit] = thresholds;
  if (req.transferSize > crit) return { dot: 'bg-ld-rose',   text: 'text-ld-rose'   };
  if (req.transferSize > warn) return { dot: 'bg-ld-amber',  text: 'text-ld-amber'  };
  return                              { dot: 'bg-ld-accent', text: 'text-ld-accent' };
}

// ─── Resource type config ─────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  ResourceType,
  { label: string; icon: React.ElementType; iconCls: string }
> = {
  script:     { label: 'JavaScript', icon: FileCode2,  iconCls: 'text-ld-amber'             },
  stylesheet: { label: 'CSS',        icon: Palette,    iconCls: 'text-ld-teal'              },
  image:      { label: 'Images',     icon: ImageIcon,  iconCls: 'text-[var(--ld-accent-2)]' },
  font:       { label: 'Fonts',      icon: Type,       iconCls: 'text-[#b08be0]'            },
  document:   { label: 'Documents',  icon: FileCode2,  iconCls: 'text-ld-rose'              },
  media:      { label: 'Media',      icon: ImageIcon,  iconCls: 'text-[#f472b6]'            },
  other:      { label: 'Other/XHR',  icon: Globe,      iconCls: 'text-ld-text-3'            },
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, valueClass }: {
  label: string; value: string; sub: string; valueClass?: string;
}) {
  return (
    <div className="rounded-[12px] border border-ld-border bg-ld-surface-2 px-[14px] py-[12px]">
      <p className="text-[11px] font-medium text-ld-text-3 uppercase tracking-wide leading-none mb-[6px]">
        {label}
      </p>
      <p className={cn('font-mono font-bold text-[22px] leading-none tabular-nums', valueClass ?? 'text-ld-text')}>
        {value}
      </p>
      <p className="text-[11px] text-ld-text-3 mt-[4px]">{sub}</p>
    </div>
  );
}

// ─── Weight stats ─────────────────────────────────────────────────────────────

function WeightStats({ resources }: { resources: ParsedResources }) {
  const { summary, requests } = resources;
  const { total, script, image } = summary;
  const criticalCount = requests.filter((r) => r.isCritical).length;

  return (
    <div className="grid grid-cols-4 max-[760px]:grid-cols-2 gap-[14px] px-[18px] py-[16px]">
      <StatCard label="Total Weight" value={fmtBytes(total.transferSize)}  sub={`${total.requestCount} requests`} />
      <StatCard label="JavaScript"   value={fmtBytes(script.transferSize)} sub={`${script.requestCount} files`}   />
      <StatCard label="Images"       value={fmtBytes(image.transferSize)}  sub={`${image.requestCount} files`}    />
      <StatCard
        label="Critical"
        value={String(criticalCount)}
        sub="oversized files"
        valueClass={criticalCount > 0 ? 'text-ld-rose' : 'text-[var(--ld-accent-2)]'}
      />
    </div>
  );
}

// ─── Resource type rows ───────────────────────────────────────────────────────

function ResourceTypeRows({ resources }: { resources: ParsedResources }) {
  const { summary } = resources;
  const total = summary.total.transferSize;

  const rows = (Object.keys(TYPE_CONFIG) as ResourceType[])
    .map((type) => ({ type, bucket: summary[type] }))
    .filter(({ bucket }) => bucket.transferSize > 0)
    .sort((a, b) => b.bucket.transferSize - a.bucket.transferSize);

  if (rows.length === 0) return null;

  return (
    <div className="px-[18px] py-[14px] border-t border-ld-border">
      <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-ld-text-3 mb-[12px]">By Type</p>
      <div className="space-y-[10px]">
        {rows.map(({ type, bucket }, i) => {
          const { label, icon: Icon, iconCls } = TYPE_CONFIG[type];
          const share = pct(bucket.transferSize, total);
          return (
            <div
              key={type}
              className="grid grid-cols-[150px_1fr_70px_70px] max-[760px]:grid-cols-[130px_1fr_70px] items-center gap-x-[12px]"
            >
              <div className="flex items-center gap-[7px] min-w-0">
                <Icon className={cn('w-[13px] h-[13px] shrink-0', iconCls)} />
                <span className="text-[12.5px] font-medium text-ld-text truncate">{label}</span>
                <span className="text-[10.5px] text-ld-text-3 shrink-0">×{bucket.requestCount}</span>
              </div>
              <div className="h-[5px] rounded-full bg-ld-border overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-ld-grad"
                  initial={{ width: 0 }}
                  animate={{ width: `${share}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.05 }}
                />
              </div>
              <span className="text-[12px] text-ld-text-3 text-right tabular-nums max-[760px]:hidden">
                {share}%
              </span>
              <span className="text-[12px] font-mono font-medium text-ld-text text-right tabular-nums">
                {fmtBytes(bucket.transferSize)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Critical resources table ─────────────────────────────────────────────────

function CriticalTable({ resources }: { resources: ParsedResources }) {
  const criticals = resources.requests
    .filter((r) => r.isCritical)
    .sort((a, b) => b.transferSize - a.transferSize);

  if (criticals.length === 0) return null;

  return (
    <div className="px-[18px] py-[14px] border-t border-ld-border">
      <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-ld-text-3 mb-[12px]">
        Oversized Resources ({criticals.length})
      </p>
      <div className="rounded-[10px] border border-ld-border overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-ld-border bg-ld-surface-2">
              <th className="text-left px-[12px] py-[8px] font-medium text-ld-text-3">Resource</th>
              <th className="text-left px-[12px] py-[8px] font-medium text-ld-text-3 w-[80px]">Type</th>
              <th className="text-right px-[12px] py-[8px] font-medium text-ld-text-3 w-[90px]">Size</th>
              <th className="w-[40px]" />
            </tr>
          </thead>
          <tbody>
            {criticals.map((req) => {
              const { dot, text } = sizeColor(req);
              const name = filename(req.url);
              return (
                <tr
                  key={req.url}
                  className="border-b border-ld-border last:border-0 hover:bg-ld-surface-hover transition-colors"
                >
                  <td className="px-[12px] py-[8px]">
                    <div className="flex items-center gap-[8px] min-w-0">
                      <span className={cn('w-[6px] h-[6px] rounded-full shrink-0', dot)} aria-hidden />
                      <span className="truncate font-mono text-ld-text max-w-[180px]" title={req.url}>
                        {name}
                      </span>
                      {req.isThirdParty && (
                        <span className="inline-flex items-center gap-[3px] px-[6px] py-[1px] rounded-full text-[10px] font-medium text-ld-text-3 border border-ld-border shrink-0">
                          <ExternalLink className="w-[9px] h-[9px]" />
                          3rd
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-[12px] py-[8px] text-ld-text-3 capitalize">{req.resourceType}</td>
                  <td className={cn('px-[12px] py-[8px] text-right font-semibold font-mono tabular-nums', text)}>
                    {fmtBytes(req.transferSize)}
                  </td>
                  <td className="px-[12px] py-[8px] text-center">
                    {req.advice ? (
                      // The table is `overflow-hidden`, so this tip has to be portalled out.
                      <InfoTip
                        icon={AlertTriangle}
                        label={`Advice for ${req.url}`}
                        content={req.advice}
                        className="text-ld-amber hover:text-ld-amber"
                      />
                    ) : (
                      <AlertTriangle className="w-[13px] h-[13px] text-ld-rose" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Detected libraries ───────────────────────────────────────────────────────

function LibraryRows({ resources }: { resources: ParsedResources }) {
  const { detectedLibraries, summary } = resources;
  if (detectedLibraries.length === 0) return null;

  const totalJs = summary.script.transferSize || 1;
  const maxSize = detectedLibraries[0]?.transferSize ?? 1;

  return (
    <div className="px-[18px] py-[14px] border-t border-ld-border">
      <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-ld-text-3 mb-[12px]">
        Detected Libraries
      </p>
      <div className="space-y-[10px]">
        {detectedLibraries.map((lib, i) => {
          const share = pct(lib.transferSize, maxSize);
          return (
            <div key={lib.name} className="space-y-[6px]">
              <div className="grid grid-cols-[1fr_70px_70px] items-center gap-x-[12px]">
                <div className="flex items-center gap-[7px] min-w-0">
                  <span className="font-mono text-[12.5px] font-semibold text-ld-text truncate">
                    {lib.name}
                  </span>
                  {lib.isThirdParty && (
                    <span className="inline-flex items-center gap-[3px] px-[6px] py-[1px] rounded-full text-[10px] font-medium text-ld-text-3 border border-ld-border shrink-0">
                      <ExternalLink className="w-[9px] h-[9px]" />
                      3rd
                    </span>
                  )}
                  {lib.isCritical && (
                    <span className="px-[6px] py-[1px] rounded-full text-[10px] font-semibold text-ld-rose border border-ld-rose-fill bg-ld-rose-soft shrink-0">
                      Heavy
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-ld-text-3 text-right tabular-nums">
                  {pct(lib.transferSize, totalJs)}% of JS
                </span>
                <span className={cn(
                  'text-[12px] font-mono font-medium text-right tabular-nums',
                  lib.isCritical ? 'text-ld-rose' : 'text-ld-text',
                )}>
                  {fmtBytes(lib.transferSize)}
                </span>
              </div>
              <div className="h-[5px] rounded-full bg-ld-border overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-ld-accent-line"
                  initial={{ width: 0 }}
                  animate={{ width: `${share}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.06 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ResourceBreakdown({ resources }: { resources: ParsedResources }) {
  const totalSize = resources.summary.total.transferSize;
  const totalLabel = fmtBytes(totalSize);

  return (
    <Panel>
      <PanelHeader
        icon={<LayoutGrid />}
        title="Resource Breakdown"
        meta={totalLabel}
      />
      <WeightStats resources={resources} />
      <ResourceTypeRows resources={resources} />
      <CriticalTable resources={resources} />
      <LibraryRows resources={resources} />
    </Panel>
  );
}
