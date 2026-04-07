import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuditItem } from '../types';

const OTHER_STYLES: Record<string, string> = {
  high:   'border-orange-500/20 bg-orange-500/5',
  medium: 'border-amber-500/20  bg-amber-500/5',
  low:    'border-border         bg-muted/30',
};
const OTHER_BADGE: Record<string, string> = {
  high:   'bg-orange-500/10 text-orange-500 border-orange-500/30',
  medium: 'bg-amber-500/10  text-amber-500  border-amber-500/30',
  low:    'bg-muted text-muted-foreground border-border',
};

function CriticalItem({ audit }: { audit: AuditItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-red-500/25 bg-red-500/5 overflow-hidden">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-red-500/10 transition-colors">
        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{audit.title}</p>
          {audit.displayValue && <p className="text-xs text-red-400 mt-0.5">{audit.displayValue}</p>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
               : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && audit.description && (
        <div className="px-4 pb-4 ml-7">
          <p className="text-xs text-muted-foreground leading-relaxed">{audit.description}</p>
        </div>
      )}
    </div>
  );
}

export function AuditList({ audits }: { audits: AuditItem[] }) {
  const critical = audits.filter((a) => a.impact === 'critical');
  const rest      = audits.filter((a) => a.impact !== 'critical');
  if (audits.length === 0) return null;

  return (
    <div className="space-y-6">
      {critical.length > 0 && (
        <div className="space-y-2">
          {critical.map((a) => <CriticalItem key={a.id} audit={a} />)}
        </div>
      )}
      {rest.length > 0 && (
        <div className="space-y-2">
          {rest.map((a) => (
            <div key={a.id} className={cn('flex items-start gap-3 rounded-lg border p-3', OTHER_STYLES[a.impact])}>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border uppercase shrink-0', OTHER_BADGE[a.impact])}>
                {a.impact}
              </span>
              <div>
                <p className="text-sm font-medium">{a.title}</p>
                {a.displayValue && <p className="text-xs text-muted-foreground mt-0.5">{a.displayValue}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
