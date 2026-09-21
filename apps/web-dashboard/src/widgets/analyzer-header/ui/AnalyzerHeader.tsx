import { Link } from 'react-router-dom';
import { GitCompareArrows, Share2, Check } from 'lucide-react';
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
  onShare:     () => void;
  /** 'idle' | 'copied' — flips the Share button into a confirmation state. */
  shareState:  'idle' | 'copied';
}

const btnCls = 'group text-[13.5px] px-[14px] py-[9px] h-auto rounded-[10px] [&_svg]:w-[15px] [&_svg]:h-[15px]';
/** Inside the joined Share/Export control: square corners, no border of its own. */
const joinedBtn = 'group text-[13.5px] px-[14px] py-[9px] h-auto border-0 [&_svg]:w-[15px] [&_svg]:h-[15px]';
const iconCls = 'text-ld-text-3 group-hover:text-ld-accent transition-colors';

export function AnalyzerHeader({ hasData, onExport, onImage, onCopyImage, onPdf, onShare, shareState }: Props) {
  return (
    // The shared page header, like every other route: the analyzer used to print its own
    // title block — same size, no channel, no rule — which made the app's most-visited
    // screen the one that did not look like the app.
    <PageHeader
      eyebrow="Analyzer"
      title="New audit"
      description="Analyze any website's performance with Lighthouse."
      actions={
        <div className="flex items-center gap-[10px] flex-wrap" data-print="hide">
          {/* Share and Export are one intention — "give this result to someone" — and were
              two separate outline buttons of the same weight as the navigation beside
              them. Joined into one control, they read as the pair they are, and the header
              goes from four equal claims to two. */}
          {hasData && (
            <div className="flex items-center rounded-[10px] border border-ld-border overflow-hidden divide-x divide-ld-border">
              <Button variant="ghost" onClick={onShare} className={`${joinedBtn} rounded-none`}>
                {shareState === 'copied'
                  ? <><Check className="text-ld-accent" /> Link copied</>
                  : <><Share2 className={iconCls} /> Share</>}
              </Button>
              <ExportMenu
                onJson={onExport}
                onImage={onImage}
                onCopyImage={onCopyImage}
                onPdf={onPdf}
                triggerClassName={`${joinedBtn} rounded-none`}
              />
            </div>
          )}

          {/* Navigation rather than an action on this result, so it is separated from the
              pair above by a rule rather than by weight: as a ghost button it read as a
              stray line of text — especially before a run, when it is the only thing in
              the header. */}
          {hasData && <span aria-hidden className="w-px h-[22px] bg-ld-border" />}

          <Button variant="outline" asChild className={btnCls}>
            <Link to="/compare">
              <GitCompareArrows className={iconCls} />
              Compare
            </Link>
          </Button>
        </div>
      }
    />
  );
}
