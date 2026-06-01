import { Link } from 'react-router-dom';
import { GitCompareArrows, Download, Lock } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ThemeToggle } from '@/shared/ui/theme/ThemeToggle';

interface Props {
  hasData:     boolean;
  onExport:    () => void;
  onAuthModal: () => void;
}

export function AnalyzerHeader({ hasData, onExport, onAuthModal }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">PerfScope</h1>
        <p className="text-sm text-muted-foreground">
          Analyze any website's performance with Lighthouse
        </p>
      </div>
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {hasData && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onExport}>
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </Button>
        )}
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <Link to="/compare">
            <GitCompareArrows className="w-3.5 h-3.5" />
            Compare Mode
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onAuthModal}>
          <Lock className="w-3.5 h-3.5" />
          Locked Page?
        </Button>
        <ThemeToggle />
      </div>
    </div>
  );
}
