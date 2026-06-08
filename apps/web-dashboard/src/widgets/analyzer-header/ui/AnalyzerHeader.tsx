import { Link } from 'react-router-dom';
import { GitCompareArrows, Download, Lock } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ThemeToggle } from '@/shared/ui/theme/ThemeToggle';

interface Props {
  hasData:     boolean;
  onExport:    () => void;
  onAuthModal: () => void;
}

const btnCls = 'group text-[13.5px] px-[14px] py-[9px] h-auto rounded-[10px] [&_svg]:w-[15px] [&_svg]:h-[15px]';
const iconCls = 'text-ld-text-3 group-hover:text-ld-accent transition-colors';

export function AnalyzerHeader({ hasData, onExport, onAuthModal }: Props) {
  return (
    <div className="flex items-start justify-between gap-5 flex-wrap mb-7">
      <div>
        <h1 className="text-[30px] font-extrabold tracking-[-0.03em] text-ld-text leading-none">PerfScope</h1>
        <p className="text-[15px] text-ld-text-2 mt-1">Analyze any website's performance with Lighthouse.</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {hasData && (
          <Button variant="outline" onClick={onExport} className={btnCls}>
            <Download className={iconCls} />
            Export JSON
          </Button>
        )}

        <Button variant="outline" asChild className={btnCls}>
          <Link to="/compare">
            <GitCompareArrows className={iconCls} />
            Compare Mode
          </Link>
        </Button>

        <Button variant="outline" onClick={onAuthModal} className={btnCls}>
          <Lock className={iconCls} />
          Locked Page?
        </Button>

      </div>
    </div>
  );
}
