import { useState }                    from 'react';
import { Moon, Globe, Loader2 }        from 'lucide-react';
import { useWebsites }                 from '@/entities/website';
import { QueryErrorPanel }             from '@/shared/ui/state-panel';
import { WebsiteAutomationCard }       from './ui/WebsiteAutomationCard';
import { UnconfiguredRow }             from './ui/UnconfiguredRow';
import { SetupModal }                  from './ui/SetupModal';
import type { Website }                from '@/entities/website';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[10px] font-mono text-[11px] tracking-[.14em] uppercase text-ld-text-3 mt-[30px] mb-[14px]">
      {children}
      <div className="flex-1 h-px bg-ld-border" />
    </div>
  );
}

export function AutomationPage() {
  const { websites, isLoading, isError, refetch } = useWebsites();
  const [setupSite, setSetupSite] = useState<Website | null>(null);

  const configured   = websites.filter(w => (w.automation?.routes ?? []).length > 0 || w.automation?.enabled);
  const unconfigured = websites.filter(w => (w.automation?.routes ?? []).length === 0 && !w.automation?.enabled);
  const enabledCount = websites.filter(w => w.automation?.enabled).length;

  return (
    <div className="max-w-[1020px] mx-auto px-6 py-[34px] pb-20">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-[50px] h-[50px] rounded-[14px] grid place-items-center shrink-0 bg-ld-grad shadow-ld-glow text-ld-grad-text">
          <Moon className="w-[25px] h-[25px]" />
        </div>
        <div>
          <h1 className="text-[clamp(24px,3vw,30px)] font-extrabold tracking-[-0.03em] text-ld-text">
            Nightly Automation
          </h1>
          <p className="text-[14.5px] text-ld-text-2 mt-1">
            Schedule a daily audit for each site and let PerfScope run while you sleep.
          </p>

          {websites.length > 0 && (
            <div className="flex gap-[9px] mt-[13px]">
              <span className={`inline-flex items-center gap-[7px] font-mono text-[12px] font-semibold px-3 py-[5px] rounded-full border transition-colors ${
                enabledCount > 0
                  ? 'text-ld-accent-2 border-ld-accent-line bg-ld-accent-soft'
                  : 'text-ld-text-2 border-ld-border'
              }`}>
                <span className="w-[7px] h-[7px] rounded-full bg-current shrink-0" />
                {enabledCount} / {websites.length} enabled
              </span>
              <span className="inline-flex items-center gap-[7px] font-mono text-[12px] font-semibold px-3 py-[5px] rounded-full border border-ld-border text-ld-text-2">
                {configured.length} configured
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-ld-accent" />
        </div>
      )}

      {/* ── Request failed ─────────────────────────────────────────────────── */}
      {!isLoading && isError && (
        <QueryErrorPanel what="your websites" onRetry={() => void refetch()} />
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!isLoading && !isError && websites.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-[18px] border border-ld-border bg-ld-surface">
          <Globe className="w-8 h-8 mb-3 text-ld-text-3" />
          <p className="text-sm font-semibold text-ld-text">No websites yet</p>
          <p className="text-xs mt-1 text-ld-text-3">Add a website first to configure nightly audits.</p>
        </div>
      )}

      {/* ── Configured ─────────────────────────────────────────────────────── */}
      {configured.length > 0 && (
        <>
          <SectionLabel>Configured</SectionLabel>
          <div className="flex flex-col gap-4">
            {configured.map(site => (
              <WebsiteAutomationCard key={site._id} site={site} />
            ))}
          </div>
        </>
      )}

      {/* ── Not configured ─────────────────────────────────────────────────── */}
      {unconfigured.length > 0 && (
        <>
          <SectionLabel>Not configured</SectionLabel>
          <div className="flex flex-col gap-[10px]">
            {unconfigured.map(site => (
              <UnconfiguredRow key={site._id} site={site} onSetup={() => setSetupSite(site)} />
            ))}
          </div>
        </>
      )}

      {/* ── Setup modal ────────────────────────────────────────────────────── */}
      {setupSite && (
        <SetupModal
          site={setupSite}
          open={!!setupSite}
          onClose={() => setSetupSite(null)}
        />
      )}
    </div>
  );
}
