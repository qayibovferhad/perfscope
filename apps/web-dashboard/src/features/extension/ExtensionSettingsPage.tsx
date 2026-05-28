import { useEffect, useState } from 'react';
import {
  Download, CheckCircle2, Circle, Copy, Check,
  Zap, BarChart3, GitCompareArrows, History, ExternalLink,
} from 'lucide-react';

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

/* ─── Tiny helpers ─────────────────────────────────────────────────────────── */

function CopySnippet({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-4 py-2.5"
      style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <code className="flex-1 text-xs font-mono text-indigo-300 truncate">{text}</code>
      <button
        onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
        className="shrink-0 p-1 rounded-lg transition-colors hover:bg-white/5"
        style={{ color: ok ? '#10b981' : '#64748b' }}
        title="Copy"
      >
        {ok ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

/* ─── Feature cards ────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: <Zap className="w-4 h-4" />,
    color: '#8B5CF6',
    glow: 'rgba(139,92,246,0.3)',
    title: 'One-click Audit',
    desc: 'Run a full Lighthouse analysis on any page without leaving the browser.',
  },
  {
    icon: <BarChart3 className="w-4 h-4" />,
    color: '#10b981',
    glow: 'rgba(16,185,129,0.3)',
    title: 'Auto-save Results',
    desc: 'Audits are automatically saved to your PerfScope account and linked to the right project.',
  },
  {
    icon: <GitCompareArrows className="w-4 h-4" />,
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.3)',
    title: 'Competitor Compare',
    desc: 'Benchmark any site against your own — LCP, CLS, TBT side by side.',
  },
  {
    icon: <History className="w-4 h-4" />,
    color: '#6366f1',
    glow: 'rgba(99,102,241,0.3)',
    title: 'Deep-link to Reports',
    desc: 'Jump directly from the extension to the full analysis in PerfScope.',
  },
];

/* ─── Install steps ────────────────────────────────────────────────────────── */

const INSTALL_STEPS = [
  { n: 1, title: 'Download the extension', desc: 'Click the download button above to get the latest build.' },
  {
    n: 2, title: 'Open Chrome Extensions',
    desc: <span>Go to <code className="text-indigo-400 text-[11px]">chrome://extensions</code> and enable <strong className="text-slate-300">Developer mode</strong>.</span>,
  },
  {
    n: 3, title: 'Extract & load',
    desc: <span>Unzip the downloaded file, click <strong className="text-slate-300">Load unpacked</strong>, and select the extracted folder.</span>,
  },
  {
    n: 4, title: 'Connect your account',
    desc: 'Keep this PerfScope page open. The extension detects your session and syncs automatically.',
  },
];

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export function ExtensionSettingsPage() {
  const connected = useExtensionConnected();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-10">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center gap-5">
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black text-white"
          style={{
            background: 'linear-gradient(135deg,#4f46e5,#8B5CF6)',
            boxShadow: '0 0 32px rgba(139,92,246,0.45)',
          }}
        >
          PS
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ps-text-heading)' }}>
            PerfScope Companion
          </h1>
          <p className="text-sm max-w-md" style={{ color: 'var(--ps-text-secondary)' }}>
            Audit any webpage, save results to your account, and compare against your sites —
            all without leaving the browser.
          </p>
        </div>

        {/* Browser badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}>
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          </svg>
          Chrome · Manifest V3
        </div>

        {/* Download button */}
        <a
          href="/perfscope-companion.zip"
          download="perfscope-companion.zip"
          className="flex items-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg,#4f46e5,#8B5CF6)',
            boxShadow: '0 0 24px rgba(139,92,246,0.45)',
          }}
        >
          <Download className="w-4 h-4" />
          Download Extension
          <span className="text-indigo-200 text-xs font-normal">v1.0.0 · 81 KB</span>
        </a>

        {/* Connection status pill */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
          style={{
            background: connected ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${connected ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)'}`,
            color: connected ? '#10b981' : 'var(--ps-text-muted)',
          }}
        >
          {connected
            ? <><CheckCircle2 className="w-3.5 h-3.5" /> Extension connected to this account</>
            : <><Circle className="w-3.5 h-3.5" /> Extension not connected</>
          }
        </div>
      </div>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map(f => (
          <div
            key={f.title}
            className="flex flex-col gap-2.5 p-4 rounded-2xl"
            style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `rgba(${hexToRgb(f.color)},0.12)`, color: f.color, boxShadow: `0 0 10px ${f.glow}` }}
            >
              {f.icon}
            </div>
            <div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--ps-text-heading)' }}>{f.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ps-text-secondary)' }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Installation guide ────────────────────────────────────────────── */}
      <section
        className="rounded-2xl p-6 flex flex-col gap-6"
        style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--ps-text-heading)' }}>
          Installation Guide
        </h2>

        <div className="flex flex-col gap-5">
          {INSTALL_STEPS.map(step => (
            <div key={step.n} className="flex gap-4">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.3)' }}
                >
                  {step.n}
                </span>
                {step.n < INSTALL_STEPS.length && (
                  <div className="flex-1 w-px" style={{ background: 'rgba(139,92,246,0.15)', minHeight: 20 }} />
                )}
              </div>
              <div className="flex flex-col gap-1 pb-1">
                <p className="text-sm font-medium" style={{ color: 'var(--ps-text-primary)' }}>{step.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--ps-text-secondary)' }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tip: rebuild */}
        <div
          className="rounded-xl px-4 py-3 flex items-start gap-2 text-xs"
          style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)' }}
        >
          <span className="text-amber-400 shrink-0 mt-0.5">💡</span>
          <span style={{ color: 'var(--ps-text-secondary)' }}>
            After a PerfScope update, a new extension build may be released. Download again and reload the
            extension in <code className="text-amber-400/80">chrome://extensions</code> to get the latest version.
          </span>
        </div>
      </section>

      {/* ── Developer: load from source ───────────────────────────────────── */}
      <section
        className="rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--ps-text-heading)' }}>
          Developer: Load from Source
        </h2>
        <p className="text-xs" style={{ color: 'var(--ps-text-secondary)' }}>
          If you are running PerfScope locally you can load the extension directly from the build output
          without downloading the zip:
        </p>
        <CopySnippet text="apps/chrome-extension/.output/chrome-mv3" />
        <p className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>
          Use <strong className="text-slate-400">Load unpacked</strong> in{' '}
          <code className="text-indigo-400/80 text-[11px]">chrome://extensions</code> and point it to the path above.
        </p>
        <a
          href="/history"
          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors w-fit"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View your audit history
        </a>
      </section>

    </div>
  );
}

/* ─── Utility ──────────────────────────────────────────────────────────────── */

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
