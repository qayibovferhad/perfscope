import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';

interface Props { hostname: string }

export function HistoryBreadcrumb({ hostname }: Props) {
  return (
    <nav className="flex items-center gap-1.5 text-sm select-none">
      <Link
        to="/app"
        className="flex items-center gap-1 font-medium transition-all duration-150 text-ps-muted hover:text-ps-accent"
        style={{ textShadow: 'none' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textShadow = '0 0 12px var(--ps-accent-glow-lg)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textShadow = 'none'; }}
      >
        Analyzer
      </Link>
      <span className="text-ps-faint text-base">›</span>
      {hostname && (
        <>
          <span className="font-mono text-[12px] text-ps-muted">{hostname}</span>
          <span className="text-ps-faint text-base">›</span>
        </>
      )}
      <div className="flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5 text-ps-accent" />
        <span className="font-semibold text-ps-heading">Performance History</span>
      </div>
    </nav>
  );
}
