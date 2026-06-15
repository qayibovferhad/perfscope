import { Link } from 'react-router-dom';
import { GitCompareArrows, History } from 'lucide-react';
import { ThemeToggle } from '@/shared/ui/theme/ThemeToggle';
import { CompareHistoryPanel } from '@/features/compare-history/ui/CompareHistoryPanel';

const T_HEX  = 'var(--ps-accent)';
const T_GLOW = 'var(--ps-accent-glow-lg)';

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-1.5 text-sm select-none flex-wrap">
      {[{ to: '/', label: 'Analyzer' }, { to: '/compare', label: 'Competitive Analysis' }].map(({ to, label }) => (
        <span key={to} className="flex items-center gap-1.5">
          <Link to={to} className="font-medium transition-all duration-150"
            style={{ color: 'rgba(255,255,255,0.38)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T_HEX; (e.currentTarget as HTMLElement).style.textShadow = `0 0 12px ${T_GLOW}`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.38)'; (e.currentTarget as HTMLElement).style.textShadow = 'none'; }}>
            {label}
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 16 }}>›</span>
        </span>
      ))}
      <div className="flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" style={{ color: T_HEX }} />
        <span className="font-semibold" style={{ color: '#e2e8f0' }}>Compare History</span>
      </div>
    </nav>
  );
}

export function CompareHistoryPage() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Breadcrumb />
        <ThemeToggle />
      </div>
      <CompareHistoryPanel />
    </div>
  );
}
