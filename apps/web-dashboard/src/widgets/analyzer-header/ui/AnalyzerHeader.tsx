import { Link } from 'react-router-dom';
import { GitCompareArrows, Lock, Share2, Check } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ExportMenu } from './ExportMenu';

interface Props {
  hasData:     boolean;
  /** The raw result, as JSON. */
  onExport:    () => void;
  /** The summary card, saved as a PNG. */
  onImage:     () => void;
  /** The same card, onto the clipboard. Resolves false when the browser refuses. */
  onCopyImage: () => Promise<boolean>;
  /** Hands the page to the browser's print pipeline, which is where a PDF comes from. */
  onPdf:       () => void;
  onAuthModal: () => void;
  onShare:     () => void;
  /** 'idle' | 'copied' — flips the Share button into a confirmation state. */
  shareState:  'idle' | 'copied';
}

const btnCls = 'group text-[13.5px] px-[14px] py-[9px] h-auto rounded-[10px] [&_svg]:w-[15px] [&_svg]:h-[15px]';
const iconCls = 'text-ld-text-3 group-hover:text-ld-accent transition-colors';

export function AnalyzerHeader({ hasData, onExport, onImage, onCopyImage, onPdf, onAuthModal, onShare, shareState }: Props) {
  return (
    <div className="flex items-start justify-between gap-5 flex-wrap mb-7">
      {/* No wordmark here. The sidebar already carries the brand on every page, and a page
          whose heading is the product's name tells you nothing about the page. */}
      <div>
        <h1 className="text-[clamp(26px,3.4vw,34px)] font-extrabold tracking-[-0.03em] text-ld-text leading-none">
          New audit
        </h1>
        <p className="text-[15px] text-ld-text-2 mt-[6px]">Analyze any website's performance with Lighthouse.</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0" data-print="hide">
        {hasData && (
          <>
            <Button variant="outline" onClick={onShare} className={btnCls}>
              {shareState === 'copied'
                ? <><Check className="text-ld-accent" /> Link copied</>
                : <><Share2 className={iconCls} /> Share</>}
            </Button>
            <ExportMenu onJson={onExport} onImage={onImage} onCopyImage={onCopyImage} onPdf={onPdf} />
          </>
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
