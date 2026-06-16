import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { RouteGroup } from '@/entities/history';

export function TrendBadge({ trend }: { trend: RouteGroup['trend'] }) {
  if (trend === 'improving') return (
    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-ps-healthy-muted text-ps-healthy">
      <TrendingUp className="w-3 h-3" /> Improving
    </span>
  );
  if (trend === 'regressing') return (
    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-ps-reg-muted text-ps-regression">
      <TrendingDown className="w-3 h-3" /> Regressing
    </span>
  );
  if (trend === 'stable') return (
    <span
      className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(148,163,184,0.12)', color: '#94a3b8' }}
    >
      <Minus className="w-3 h-3" /> Stable
    </span>
  );
  return null;
}
