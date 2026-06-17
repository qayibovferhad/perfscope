import { Link } from 'react-router-dom';
import { Activity, TrendingUp } from 'lucide-react';

interface Props { hostname: string }

export function HistoryBreadcrumb({ hostname }: Props) {
  return (
    <nav className="flex items-center gap-[10px] text-[14px] flex-wrap">
      <Link
        to="/app"
        className="inline-flex items-center gap-[7px] font-medium text-ld-text-3 transition-colors duration-200 hover:text-ld-accent"
      >
        <Activity className="w-[15px] h-[15px]" />
        Analyzer
      </Link>
      <span className="text-ld-text-3 opacity-50 text-[16px] leading-none">›</span>
      {hostname && (
        <>
          <span className="font-mono text-[12.5px] text-ld-text-3">{hostname}</span>
          <span className="text-ld-text-3 opacity-50 text-[16px] leading-none">›</span>
        </>
      )}
      <span className="inline-flex items-center gap-[7px] font-semibold text-ld-text">
        <TrendingUp className="w-[16px] h-[16px] text-ld-accent" />
        Performance History
      </span>
    </nav>
  );
}
