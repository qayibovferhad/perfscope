import { Link } from 'react-router-dom';
import { GitCompareArrows, Lock, Share2, Check } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { PageHeader } from '@/shared/ui/page';
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
    // The shared page header, like every other route: the analyzer used to print its own
    // title block — same size, no channel, no rule — which made the app's most-visited
    // screen the one that did not look like the app.
    <PageHeader
      eyebrow="Analyzer"
      title="New audit"
      description="Analyze any website's performance with Lighthouse."
      actions={
        <div className="flex items-center gap-2 flex-wrap" data-print="hide">
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
      }
    />
  );
}
