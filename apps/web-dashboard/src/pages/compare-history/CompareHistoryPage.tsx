import { Link } from 'react-router-dom';
import { Page } from '@/shared/ui/page';
import { History } from 'lucide-react';
import { ThemeToggle } from '@/shared/ui/theme/ThemeToggle';
import { CompareHistoryPanel } from '@/features/compare-history';

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-1.5 text-sm select-none flex-wrap">
      {[{ to: '/', label: 'Analyzer' }, { to: '/compare', label: 'Competitive Analysis' }].map(({ to, label }) => (
        <span key={to} className="flex items-center gap-1.5">
          <Link
            to={to}
            className="font-medium transition-all duration-150 text-ld-text-3 hover:text-ld-accent hover:[text-shadow:0_0_12px_var(--ld-accent-line)]"
          >
            {label}
          </Link>
          <span className="text-ld-text-3 text-[16px]">›</span>
        </span>
      ))}
      <div className="flex items-center gap-1.5">
        <History className="w-3.5 h-3.5 text-ld-accent" />
        <span className="font-semibold text-ld-text">Compare History</span>
      </div>
    </nav>
  );
}

export function CompareHistoryPage() {
  return (
    <Page width="wide" className="space-y-6">
      <div className="flex items-center justify-between">
        <Breadcrumb />
        <ThemeToggle />
      </div>
      <CompareHistoryPanel />
    </Page>
  );
}
