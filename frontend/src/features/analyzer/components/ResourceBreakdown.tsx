import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCode2, Palette, ImageIcon, Type, Globe,
  ExternalLink, AlertTriangle, Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ParsedResources, ResourceType, NetworkRequest } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

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
  if (!thresholds) return { dot: 'bg-muted-foreground', text: 'text-muted-foreground' };
  const [warn, crit] = thresholds;
  if (req.transferSize > crit) return { dot: 'bg-red-500',   text: 'text-red-500'   };
  if (req.transferSize > warn) return { dot: 'bg-amber-500', text: 'text-amber-500' };
  return                              { dot: 'bg-emerald-500', text: 'text-emerald-500' };
}

// ─── Resource type config ─────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  ResourceType,
  { label: string; icon: React.ElementType; bar: string; iconColor: string }
> = {
  script:     { label: 'JavaScript', icon: FileCode2,  bar: 'bg-indigo-500',        iconColor: 'text-indigo-400'       },
  stylesheet: { label: 'CSS',        icon: Palette,    bar: 'bg-violet-500',         iconColor: 'text-violet-400'       },
  image:      { label: 'Images',     icon: ImageIcon,  bar: 'bg-emerald-500',        iconColor: 'text-emerald-400'      },
  font:       { label: 'Fonts',      icon: Type,       bar: 'bg-amber-500',          iconColor: 'text-amber-400'        },
  document:   { label: 'Documents',  icon: FileCode2,  bar: 'bg-sky-500',            iconColor: 'text-sky-400'          },
  media:      { label: 'Media',      icon: ImageIcon,  bar: 'bg-pink-500',           iconColor: 'text-pink-400'         },
  other:      { label: 'Other',      icon: Globe,      bar: 'bg-muted-foreground',   iconColor: 'text-muted-foreground' },
};

// ─── Inline tooltip ───────────────────────────────────────────────────────────

function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 pointer-events-none"
          >
            <div className="rounded-md bg-popover border border-border shadow-lg px-3 py-2 text-xs text-popover-foreground leading-relaxed">
              <div className="flex gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{content}</span>
              </div>
              {/* Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-[-1px] border-4 border-transparent border-t-popover" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AnimatedBar({ value, colorClass, delay = 0 }: { value: number; colorClass: string; delay?: number }) {
  return (
    <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <motion.div
        className={cn('absolute inset-y-0 left-0 rounded-full', colorClass)}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.6, ease: 'easeOut', delay }}
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
      {children}
    </p>
  );
}

// ─── Weight stats ─────────────────────────────────────────────────────────────

function WeightStats({ resources }: { resources: ParsedResources }) {
  const { summary, requests } = resources;
  const { total, script, image } = summary;
  const criticalCount = requests.filter((r) => r.isCritical).length;

  const stats = [
    { label: 'Total Weight', value: formatBytes(total.transferSize),  sub: `${total.requestCount} requests` },
    { label: 'JavaScript',   value: formatBytes(script.transferSize), sub: `${script.requestCount} files`   },
    { label: 'Images',       value: formatBytes(image.transferSize),  sub: `${image.requestCount} files`    },
    { label: 'Critical',     value: `${criticalCount}`,               sub: 'oversized files',
      valueClass: criticalCount > 0 ? 'text-red-500' : undefined },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {stats.map(({ label, value, sub, valueClass }) => (
        <div key={label} className="text-center space-y-0.5">
          <p className={cn('text-base font-bold tabular-nums text-foreground', valueClass)}>{value}</p>
          <p className="text-[10px] font-medium text-muted-foreground leading-none">{label}</p>
          <p className="text-[10px] text-muted-foreground/60">{sub}</p>
        </div>
      ))}
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

  return (
    <div className="space-y-2.5">
      {rows.map(({ type, bucket }, i) => {
        const { label, icon: Icon, bar, iconColor } = TYPE_CONFIG[type];
        const share = pct(bucket.transferSize, total);
        return (
          <div key={type} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Icon className={cn('w-3.5 h-3.5', iconColor)} />
                <span className="font-medium text-foreground">{label}</span>
                <span className="text-muted-foreground">
                  ({bucket.requestCount} {bucket.requestCount === 1 ? 'file' : 'files'})
                </span>
              </div>
              <div className="flex items-center gap-2 tabular-nums">
                <span className="text-muted-foreground">{share}%</span>
                <span className="font-medium text-foreground w-16 text-right">
                  {formatBytes(bucket.transferSize)}
                </span>
              </div>
            </div>
            <AnimatedBar value={share} colorClass={bar} delay={i * 0.05} />
          </div>
        );
      })}
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
    <div>
      <SectionLabel>Oversized Resources ({criticals.length})</SectionLabel>
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Resource</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-20">Type</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">Size</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-10" />
            </tr>
          </thead>
          <tbody>
            {criticals.map((req) => {
              const { dot, text } = sizeColor(req);
              const name = filename(req.url);
              return (
                <tr
                  key={req.url}
                  className={cn(
                    'border-b border-border/50 last:border-0 transition-colors hover:bg-muted/20',
                  )}
                >
                  {/* Resource name */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', dot)}
                        aria-hidden
                      />
                      <span className="truncate font-mono text-foreground max-w-[180px]" title={req.url}>
                        {name}
                      </span>
                      {req.isThirdParty && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5 shrink-0">
                          <ExternalLink className="w-2.5 h-2.5" />
                          3rd
                        </Badge>
                      )}
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-3 py-2 text-muted-foreground capitalize">{req.resourceType}</td>

                  {/* Size with colour */}
                  <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', text)}>
                    {formatBytes(req.transferSize)}
                  </td>

                  {/* Warning + advice tooltip */}
                  <td className="px-3 py-2 text-center">
                    {req.advice ? (
                      <Tooltip content={req.advice}>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 cursor-help" />
                      </Tooltip>
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
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
    <div>
      <SectionLabel>Detected Libraries</SectionLabel>
      <div className="space-y-2">
        {detectedLibraries.map((lib, i) => {
          const share = pct(lib.transferSize, maxSize);
          return (
            <div key={lib.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono font-semibold text-foreground truncate">{lib.name}</span>
                  {lib.isThirdParty && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5 shrink-0">
                      <ExternalLink className="w-2.5 h-2.5" />
                      3rd
                    </Badge>
                  )}
                  {lib.isCritical && (
                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                      Too Heavy
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 tabular-nums shrink-0 ml-2">
                  <span className="text-muted-foreground">{pct(lib.transferSize, totalJs)}% of JS</span>
                  <span className={cn('font-medium w-16 text-right', lib.isCritical ? 'text-red-500' : 'text-foreground')}>
                    {formatBytes(lib.transferSize)}
                  </span>
                </div>
              </div>
              <AnimatedBar
                value={share}
                colorClass={lib.isCritical ? 'bg-red-500' : 'bg-indigo-500'}
                delay={i * 0.06}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ResourceBreakdown({ resources }: { resources: ParsedResources }) {
  const totalMB = (resources.summary.total.transferSize / (1024 * 1024)).toFixed(2);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Resource Breakdown</CardTitle>
          <Badge variant="secondary" className="font-mono text-xs tabular-nums">
            {totalMB} MB total
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <WeightStats resources={resources} />

        <div>
          <SectionLabel>By Type (transfer size)</SectionLabel>
          <ResourceTypeRows resources={resources} />
        </div>

        <CriticalTable resources={resources} />
        <LibraryRows resources={resources} />
      </CardContent>
    </Card>
  );
}
