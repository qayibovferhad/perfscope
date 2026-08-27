import { Download, CheckCircle2, Circle, Lightbulb, ArrowRight } from 'lucide-react';
import { Page } from '@/shared/ui/page';
import { useExtensionConnected }      from '@/features/extension';
import { CopySnippet }                from '@/shared/ui/copy-snippet';
import { Button }                     from '@/shared/ui/button';
import { Panel }                      from '@/shared/ui/panel';
import { FeatureCard }                from './ui/FeatureCard';
import { StepRow }                    from './ui/StepRow';
import { FEATURES, INSTALL_STEPS, HOW_IT_WORKS } from './config';

function ChromeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 3.5A4.5 4.5 0 0 1 16.5 10H21a9 9 0 0 1-4.72 7.91L14 12.83A4.5 4.5 0 0 1 12 15.5a4.5 4.5 0 0 1-2-.47l-2.29 3.96A9 9 0 0 1 3 12h4.5A4.5 4.5 0 0 1 12 5.5z" />
    </svg>
  );
}

export function ExtensionSettingsPage() {
  const connected = useExtensionConnected();

  return (
    <Page width="narrow">
      <div className="flex flex-col gap-[18px]">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center mb-4">

        {/* Logo tile */}
        <div className="w-[84px] h-[84px] rounded-[22px] grid place-items-center font-mono font-bold text-[30px] tracking-tight mb-[22px] bg-ld-grad text-ld-grad-text shadow-ld-glow">
          PS
        </div>

        <h1 className="text-[clamp(28px,4vw,40px)] font-extrabold tracking-[-0.03em] text-ld-text">
          PerfScope Companion
        </h1>
        <p className="text-ld-text-2 text-[16px] max-w-[46ch] mt-[14px] leading-[1.55] mx-auto">
          Audit any webpage, save results to your account, and compare against your sites —
          all without leaving the browser.
        </p>

        {/* Chrome tag */}
        <div className="inline-flex items-center gap-2 font-mono text-[12.5px] font-semibold px-[14px] py-[7px] rounded-full border border-ld-accent-line bg-ld-accent-soft text-ld-accent-2 mt-[22px]">
          <ChromeIcon className="w-[14px] h-[14px]" />
          Chrome · Manifest V3
        </div>

        {/* Download + status */}
        <div className="flex flex-col items-center gap-[14px] mt-[22px]">
          <Button asChild size="lg">
            <a href="/perfscope-companion.zip" download="perfscope-companion.zip">
              <Download />
              Download Extension
              <span className="text-[12px] font-normal opacity-80">v1.0.0 · 81 KB</span>
            </a>
          </Button>

          {connected ? (
            <div className="inline-flex items-center gap-[9px] text-[13.5px] font-semibold text-ld-accent-2 px-[16px] py-[9px] rounded-full border border-ld-accent-line bg-ld-accent-soft">
              <CheckCircle2 className="w-4 h-4" />
              Extension connected to this account
            </div>
          ) : (
            <div className="inline-flex items-center gap-[9px] text-[13.5px] font-semibold text-ld-text-3 px-[16px] py-[9px] rounded-full border border-ld-border">
              <Circle className="w-4 h-4" />
              Not connected yet
            </div>
          )}
        </div>
      </div>

      {/* ── Feature grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
        {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
      </div>

      {/* ── Installation guide ────────────────────────────────────────────── */}
      <Panel className="p-[26px] shadow-ld-shadow-card">
        <h2 className="text-[18px] font-bold tracking-[-0.01em] mb-[22px] text-ld-text">
          Installation guide
        </h2>

        <div>
          {INSTALL_STEPS.map((step, i) => (
            <StepRow key={step.n} {...step} isLast={i === INSTALL_STEPS.length - 1} />
          ))}
        </div>

        {/* Amber tip */}
        <div className="flex gap-3 items-start mt-[22px] px-4 py-[14px] rounded-[12px] bg-ld-amber-wash border border-ld-amber-line">
          <Lightbulb className="w-[18px] h-[18px] text-ld-amber shrink-0 mt-[1px]" />
          <p className="text-[13px] text-ld-text-2 leading-[1.55]">
            After a PerfScope update, download again and reload the extension in{' '}
            <code className="font-mono text-[12px] text-ld-amber">chrome://extensions</code>
            {' '}to get the latest version.
          </p>
        </div>
      </Panel>

      {/* ── Developer: load from source ───────────────────────────────────── */}
      <Panel className="p-[26px] shadow-ld-shadow-card">
        <h2 className="text-[18px] font-bold tracking-[-0.01em] mb-[22px] text-ld-text">
          Developer: load from source
        </h2>
        <p className="text-[14px] text-ld-text-2 leading-[1.5] mb-4">
          If you are running PerfScope locally you can load the extension directly from the build output:
        </p>
        <CopySnippet text="apps/chrome-extension/.output/chrome-mv3" />
      </Panel>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <Panel className="p-[26px] shadow-ld-shadow-card">
        <h2 className="text-[18px] font-bold tracking-[-0.01em] mb-[22px] text-ld-text">
          How it works
        </h2>

        <ul className="flex flex-col gap-[13px]">
          {HOW_IT_WORKS.map((item, i) => (
            <li key={i} className="flex items-center gap-[13px] text-[14px] text-ld-text-2">
              <item.Icon className="w-[18px] h-[18px] text-ld-accent shrink-0" />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>

        <a
          href="/history"
          className="inline-flex items-center gap-2 text-[14px] font-semibold text-ld-accent mt-5 transition-all duration-200 hover:gap-3"
        >
          View your audit history
          <ArrowRight className="w-[15px] h-[15px]" />
        </a>
      </Panel>

      </div>
    </Page>
  );
}
