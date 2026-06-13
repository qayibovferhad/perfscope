import type React from 'react';
import { Zap, BarChart3, GitCompareArrows, History, Search, Database, Link2 } from 'lucide-react';

export const FEATURES: { Icon: React.ComponentType<{ className?: string }>; title: string; desc: string }[] = [
  { Icon: Zap,              title: 'One-click Audit',    desc: 'Run a full Lighthouse analysis on any page without leaving the browser.' },
  { Icon: BarChart3,        title: 'Auto-save Results',  desc: 'Audits are saved to your account and linked to the right project automatically.' },
  { Icon: GitCompareArrows, title: 'Competitor Compare', desc: 'Benchmark any site against your own — LCP, CLS, TBT side by side.' },
  { Icon: History,          title: 'Deep-link Reports',  desc: 'Jump from the extension straight to the full analysis in PerfScope.' },
];

export const INSTALL_STEPS: { n: number; title: string; body: React.ReactNode }[] = [
  { n: 1, title: 'Download the extension', body: 'Click the download button above to get the latest build.' },
  {
    n: 2,
    title: 'Open Chrome extensions',
    body: (
      <>
        Go to{' '}
        <code className="font-mono text-[12.5px] px-[6px] py-[1px] rounded-[5px] bg-ld-bg-2 border border-ld-border text-ld-accent-2">
          chrome://extensions
        </code>
        {' '}and enable <b className="text-ld-text font-semibold">Developer mode</b>.
      </>
    ),
  },
  {
    n: 3,
    title: 'Extract & load',
    body: (
      <>
        Unzip the file, click <b className="text-ld-text font-semibold">Load unpacked</b>, and select the extracted folder.
      </>
    ),
  },
  { n: 4, title: 'Connect your account', body: 'Keep this PerfScope page open. The extension detects your session and syncs automatically.' },
];

export const HOW_IT_WORKS: { Icon: React.ComponentType<{ className?: string }>; text: React.ReactNode }[] = [
  { Icon: Search,    text: <>Click the <b className="text-ld-text font-semibold">PS</b> icon on any page to open the extension popup.</> },
  { Icon: Zap,       text: <><b className="text-ld-text font-semibold">Quick Audit</b> runs a full Lighthouse analysis on the active tab.</> },
  { Icon: Database,  text: 'Results are saved to your history and linked to the matching project.' },
  { Icon: BarChart3, text: <><b className="text-ld-text font-semibold">Compare</b> tab benchmarks any competitor page against your own sites.</> },
  { Icon: Link2,     text: <><b className="text-ld-text font-semibold">View full report</b> opens the audit directly in the PerfScope analyzer.</> },
];
