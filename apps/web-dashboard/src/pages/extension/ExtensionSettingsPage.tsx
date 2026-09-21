import { Download, CheckCircle2, Circle, Lightbulb, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Page, PageHeader } from '@/shared/ui/page';
import { useExtensionConnected }      from '@/features/extension';
import { CopySnippet }                from '@/shared/ui/copy-snippet';
import { Button }                     from '@/shared/ui/button';
import { Panel, PanelHeader, PanelBody } from '@/shared/ui/panel';
import { InstrumentField }            from '@/shared/ui/instrument';
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

/**
 * The companion extension: what it is, and how to get it running.
 *
 * It used to open with a centred logo, a centred headline and a two-by-two grid of feature
 * cards — the landing page of a product the reader has already bought, and the single most
 * template-shaped screen in the app. It is a page *inside* the workspace, so it takes the
 * workspace's header like every other route, and the space goes to the two things somebody
 * is actually here for: the download, and the four steps after it.
 */
export function ExtensionSettingsPage() {
  const connected = useExtensionConnected();

  return (
    <Page>
      <PageHeader
        eyebrow="Extension"
        title="PerfScope Companion"
        description="Audit any webpage, save the result to your account, and compare it against your sites — without leaving the browser."
        actions={
          <Button asChild size="lg">
            <a href="/perfscope-companion.zip" download="perfscope-companion.zip">
              <Download />
              Download
              <span className="font-mono text-[12px] font-normal">v1.0.0 · 81 KB</span>
            </a>
          </Button>
        }
      />

      {/* The status band. Whether the extension has found this account is the one live
          reading on the page, so it is the page's instrument — and the four capabilities
          sit beside it as its legend rather than as four cards competing with it. */}
      <InstrumentField className="mb-[22px]">
        <div className="flex items-stretch max-[820px]:flex-col">
          <div className="flex items-center gap-[16px] px-[24px] py-[20px] shrink-0 max-sm:px-[16px]">
            <div className="w-[62px] h-[62px] rounded-[18px] grid place-items-center font-mono font-bold text-[22px] tracking-tight bg-ld-grad text-ld-grad-text shadow-ld-glow shrink-0">
              PS
            </div>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-[7px] font-mono text-[11.5px] font-semibold px-[10px] py-[4px] rounded-full border border-ld-accent-line bg-ld-accent-soft text-ld-accent-2">
                <ChromeIcon className="w-[13px] h-[13px]" />
                Chrome · Manifest V3
              </span>
              <span className={`flex items-center gap-[8px] text-[13px] font-semibold mt-[10px] ${
                connected ? 'text-ld-accent-2' : 'text-ld-text-3'
              }`}>
                {connected
                  ? <><CheckCircle2 className="w-[15px] h-[15px]" /> Connected to this account</>
                  : <><Circle className="w-[15px] h-[15px]" /> Not connected yet</>}
              </span>
            </div>
          </div>

          {/* Two columns of plain rows. Four bordered cards said these were four separate
              subjects; they are one list of what the thing does. */}
          <ul className="flex-1 grid grid-cols-2 gap-x-[22px] gap-y-[12px] px-[24px] py-[20px] max-sm:px-[16px]
                         border-l border-ld-border max-[820px]:border-l-0 max-[820px]:border-t
                         max-[620px]:grid-cols-1">
            {FEATURES.map(f => (
              <li key={f.title} className="flex gap-[11px] min-w-0">
                <f.Icon className="w-[16px] h-[16px] text-ld-accent shrink-0 mt-[2px]" />
                <div className="min-w-0">
                  <b className="block text-[13.5px] font-semibold text-ld-text">{f.title}</b>
                  <span className="block text-[12.5px] text-ld-text-2 leading-[1.5] mt-[2px]">{f.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </InstrumentField>

      {/* Install on the left, because it is what the page is for; everything else is
          reference and sits in the narrower column beside it. */}
      <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-[18px] items-start max-lg:grid-cols-1">
        <Panel className="shadow-ld-shadow-card">
          <PanelHeader icon={<Download />} title="Installation" meta={`${INSTALL_STEPS.length} steps`} />
          <PanelBody className="px-[22px] py-[20px]">
            {INSTALL_STEPS.map((step, i) => (
              <StepRow key={step.n} {...step} isLast={i === INSTALL_STEPS.length - 1} />
            ))}

            <div className="flex gap-3 items-start mt-[18px] px-4 py-[13px] rounded-[12px] bg-ld-amber-wash border border-ld-amber-line">
              <Lightbulb className="w-[17px] h-[17px] text-ld-amber shrink-0 mt-[1px]" />
              <p className="text-[12.5px] text-ld-text-2 leading-[1.55]">
                After a PerfScope update, download again and reload the extension in{' '}
                <code className="font-mono text-[12px] text-ld-amber">chrome://extensions</code>
                {' '}to get the latest version.
              </p>
            </div>
          </PanelBody>
        </Panel>

        <div className="flex flex-col gap-[18px]">
          <Panel className="shadow-ld-shadow-card">
            <PanelHeader icon={<ArrowRight />} title="How it works" />
            <PanelBody className="px-[22px] py-[18px]">
              <ul className="flex flex-col gap-[12px]">
                {HOW_IT_WORKS.map((item, i) => (
                  <li key={i} className="flex items-start gap-[11px] text-[13.5px] text-ld-text-2 leading-[1.5]">
                    <item.Icon className="w-[16px] h-[16px] text-ld-accent shrink-0 mt-[2px]" />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/history"
                className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-ld-accent mt-[16px] transition-all duration-200 hover:gap-3"
              >
                View your audit history
                <ArrowRight className="w-[15px] h-[15px]" />
              </Link>
            </PanelBody>
          </Panel>

          <Panel className="shadow-ld-shadow-card">
            <PanelHeader icon={<Download />} title="Load from source" />
            <PanelBody className="px-[22px] py-[18px]">
              <p className="text-[13px] text-ld-text-2 leading-[1.5] mb-[12px]">
                Running PerfScope locally? Load the extension straight from the build output.
              </p>
              <CopySnippet text="apps/chrome-extension/.output/chrome-mv3" />
            </PanelBody>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
