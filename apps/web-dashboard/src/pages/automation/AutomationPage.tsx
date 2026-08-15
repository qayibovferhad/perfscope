import { useState }                    from 'react';
import { Link }                        from 'react-router-dom';
import { Page, PageHeader } from '@/shared/ui/page';
import { Globe, Loader2 }              from 'lucide-react';
import { useWebsites }                 from '@/entities/website';
import { StatePanel, QueryErrorPanel } from '@/shared/ui/state-panel';
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
    <Page>
      {/* Named for what it is rather than when it runs: routes can be spread across the
          day or given a timetable of their own, so "nightly" stopped being true. */}
      <PageHeader
        eyebrow="Automation"
        title="Audit schedule"
        description={<>
          Decide when each site is audited without anyone pressing anything. What the
          timetable finds lands in{' '}
          <Link to="/scheduled" className="font-semibold text-ld-accent hover:underline">
            Scheduled reports
          </Link>
          .
        </>}
        meta={websites.length > 0 ? (
          <>
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
          </>
        ) : undefined}
      />

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
        <StatePanel
          icon={<Globe className="w-6 h-6" />}
          title="No websites yet"
          description="Add a website first to configure nightly audits."
        />
      )}

      {/* ── Configured ─────────────────────────────────────────────────────── */}
      {configured.length > 0 && (
        <>
          <SectionLabel>Configured</SectionLabel>
          <div className="flex flex-col gap-4">
            {configured.map(site => (
              <WebsiteAutomationCard key={site._id} site={site} onConfigure={() => setSetupSite(site)} />
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
          // Remount when the site changes: the form hydrates from `site` in its useState
          // initialisers, which only run on mount.
          key={setupSite._id}
          site={setupSite}
          open={!!setupSite}
          onClose={() => setSetupSite(null)}
        />
      )}
    </Page>
  );
}
