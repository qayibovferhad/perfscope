import { useEffect, useState } from 'react';
import {
  Download, CheckCircle2, Circle, Copy, Check,
  Zap, BarChart3, GitCompareArrows, History, ExternalLink,
} from 'lucide-react';

function ChromeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    </svg>
  );
}
import { Surface }       from '@/shared/components/ui/surface';
import { StatusPill }    from '@/shared/components/ui/status-pill';
import { GradientIcon }  from '@/shared/components/ui/gradient-icon';

/* ─── Connection hook ──────────────────────────────────────────────────────── */

function useExtensionConnected() {
  const [connected, setConnected] = useState<boolean | null>(null);
  useEffect(() => {
    setConnected(localStorage.getItem('perfscope-auth') !== null);
    const handler = () => setConnected(localStorage.getItem('perfscope-auth') !== null);
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  return connected;
}

/* ─── CopySnippet ──────────────────────────────────────────────────────────── */

function CopySnippet({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 bg-black/30 border border-white/[0.06]">
      <code className="flex-1 text-xs font-mono text-ps-accent truncate">{text}</code>
      <button
        onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
        className="shrink-0 p-1 rounded-lg transition-colors hover:bg-white/5 text-ps-secondary data-[ok=true]:text-ps-healthy"
        data-ok={ok}
        title="Copy"
      >
        {ok ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

/* ─── Data ─────────────────────────────────────────────────────────────────── */

const FEATURES = [
  { icon: <Zap              className="w-4 h-4" />, tone: 'accent'  as const, title: 'One-click Audit',     desc: 'Run a full Lighthouse analysis on any page without leaving the browser.' },
  { icon: <BarChart3        className="w-4 h-4" />, tone: 'healthy' as const, title: 'Auto-save Results',   desc: 'Audits are saved to your account and linked to the right project automatically.' },
  { icon: <GitCompareArrows className="w-4 h-4" />, tone: 'amber'   as const, title: 'Competitor Compare', desc: 'Benchmark any site against your own — LCP, CLS, TBT side by side.' },
  { icon: <History          className="w-4 h-4" />, tone: 'accent'  as const, title: 'Deep-link Reports',  desc: 'Jump from the extension to the full analysis in PerfScope.' },
];

const INSTALL_STEPS = [
  { n: 1, title: 'Download the extension', body: 'Click the download button above to get the latest build.' as React.ReactNode },
  { n: 2, title: 'Open Chrome Extensions',  body: <span>Go to <code className="text-ps-accent text-[11px]">chrome://extensions</code> and enable <strong className="text-ps-body">Developer mode</strong>.</span> },
  { n: 3, title: 'Extract & load',          body: <span>Unzip the file, click <strong className="text-ps-body">Load unpacked</strong>, and select the extracted folder.</span> },
  { n: 4, title: 'Connect your account',    body: 'Keep this PerfScope page open. The extension detects your session and syncs automatically.' },
];

const HOW_IT_WORKS = [
  { icon: '🔍', text: 'Click the PS icon on any page to open the extension popup' },
  { icon: '⚡', text: 'Quick Audit runs a full Lighthouse analysis on the active tab' },
  { icon: '💾', text: 'Results are saved to your history and linked to the matching project' },
  { icon: '📊', text: 'Compare tab benchmarks any competitor page against your own sites' },
  { icon: '🔗', text: '"View full report" opens the audit directly in the PerfScope analyzer' },
];

/* ─── Reusable bits ────────────────────────────────────────────────────────── */

function FeatureCard({ icon, tone, title, desc }: typeof FEATURES[number]) {
  return (
    <Surface padding="md" className="flex flex-col gap-2.5">
      <Surface tone={tone} padding="none" className="w-8 h-8 flex items-center justify-center rounded-xl">
        <span className={`text-ps-${tone === 'accent' ? 'accent' : tone === 'amber' ? 'amber' : 'healthy'}`}>
          {icon}
        </span>
      </Surface>
      <div>
        <p className="text-sm font-semibold mb-0.5 text-ps-heading">{title}</p>
        <p className="text-xs leading-relaxed text-ps-secondary">{desc}</p>
      </div>
    </Surface>
  );
}

function StepRow({ n, title, body, isLast }: { n: number; title: string; body: React.ReactNode; isLast: boolean }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center gap-1 shrink-0">
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                         bg-ps-accent-muted border border-ps-accent-border text-ps-accent">
          {n}
        </span>
        {!isLast && <div className="flex-1 w-px min-h-5 bg-ps-accent-border" />}
      </div>
      <div className="flex flex-col gap-1 pb-1">
        <p className="text-sm font-medium text-ps-body">{title}</p>
        <p className="text-xs leading-relaxed text-ps-secondary">{body}</p>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export function ExtensionSettingsPage() {
  const connected = useExtensionConnected();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-10">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center gap-5">
        <GradientIcon size="lg">PS</GradientIcon>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-ps-heading">PerfScope Companion</h1>
          <p className="text-sm max-w-md text-ps-secondary">
            Audit any webpage, save results to your account, and compare against your sites —
            all without leaving the browser.
          </p>
        </div>

        <StatusPill tone="accent">
          <ChromeIcon className="w-3.5 h-3.5" />
          Chrome · Manifest V3
        </StatusPill>

        <a
          href="/perfscope-companion.zip"
          download="perfscope-companion.zip"
          className="flex items-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-semibold text-white
                     bg-ps-brand shadow-glow-accent-lg
                     transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Download className="w-4 h-4" />
          Download Extension
          <span className="text-ps-accent-muted text-xs font-normal opacity-90">v1.0.0 · 81 KB</span>
        </a>

        {connected
          ? <StatusPill tone="success"><CheckCircle2 className="w-3.5 h-3.5" />Extension connected to this account</StatusPill>
          : <StatusPill tone="neutral"><Circle className="w-3.5 h-3.5" />Extension not connected</StatusPill>
        }
      </div>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
      </div>

      {/* ── Installation guide ────────────────────────────────────────────── */}
      <Surface padding="lg" className="flex flex-col gap-6">
        <h2 className="text-sm font-semibold text-ps-heading">Installation Guide</h2>

        <div className="flex flex-col gap-5">
          {INSTALL_STEPS.map((step, i) => (
            <StepRow key={step.n} {...step} isLast={i === INSTALL_STEPS.length - 1} />
          ))}
        </div>

        <Surface tone="amber" padding="sm" className="flex items-start gap-2 text-xs">
          <span className="text-ps-amber shrink-0 mt-0.5">💡</span>
          <span className="text-ps-secondary">
            After a PerfScope update, download again and reload the extension in{' '}
            <code className="text-ps-amber">chrome://extensions</code> to get the latest version.
          </span>
        </Surface>
      </Surface>

      {/* ── Developer: load from source ───────────────────────────────────── */}
      <Surface padding="lg" className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-ps-heading">Developer: Load from Source</h2>
        <p className="text-xs text-ps-secondary">
          If you are running PerfScope locally you can load the extension directly from the build output:
        </p>
        <CopySnippet text="apps/chrome-extension/.output/chrome-mv3" />

        <h3 className="text-sm font-semibold text-ps-heading mt-2">How it works</h3>
        <ul className="flex flex-col gap-2.5">
          {HOW_IT_WORKS.map(({ icon, text }) => (
            <li key={text} className="flex items-start gap-2.5 text-xs text-ps-secondary">
              <span className="shrink-0 mt-0.5">{icon}</span>{text}
            </li>
          ))}
        </ul>

        <a href="/history" className="flex items-center gap-1.5 text-xs text-ps-accent hover:opacity-80 transition-opacity w-fit mt-1">
          <ExternalLink className="w-3.5 h-3.5" />
          View your audit history
        </a>
      </Surface>

    </div>
  );
}
