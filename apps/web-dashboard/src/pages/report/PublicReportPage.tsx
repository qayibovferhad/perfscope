import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Activity, Loader2, FileQuestion, Monitor, Smartphone } from 'lucide-react';
import { fetchJson } from '@/shared/api/client';
import { ThemeToggle } from '@/shared/ui/theme/ThemeToggle';
import { Button } from '@/shared/ui/button';
import { StatePanel } from '@/shared/ui/state-panel';
import { AnalyzerResultsPanel } from '@/widgets/analyzer-results';
import type { AnalysisResult } from '@/entities/analysis';

/**
 * Read-only audit report behind an unguessable share token — no login required.
 *
 * Fetched through React Query like every other screen, rather than from an effect into
 * local state: this is the one page that had its own loading/error machinery, and it also
 * meant a revoked link retried nothing and cached nothing.
 */
export function PublicReportPage() {
  const { token } = useParams<{ token: string }>();

  const { data: result, isPending, isError } = useQuery<AnalysisResult>({
    queryKey: ['public-report', token],
    enabled:  !!token,
    queryFn:  () => fetchJson<AnalysisResult>(`/public/report/${token}`),
  });

  // A missing token is not a pending request — there is nothing to wait for.
  const status = !token || isError ? 'error' : isPending ? 'loading' : 'ready';

  return (
    <div className="min-h-screen bg-ld-bg">
      {/* Minimal public header */}
      <header className="border-b border-ld-border bg-ld-surface">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-[10px] grid place-items-center bg-[image:var(--ld-grad)] text-[var(--ld-grad-text)]">
              <Activity className="w-4 h-4" />
            </span>
            <span className="text-[17px] font-extrabold tracking-[-0.02em] text-ld-text">
              Perf<span className="text-ld-accent">Scope</span>
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[.14em] text-ld-text-3 mt-0.5">
              Shared report
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm">
              <Link to="/">Run your own audit</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        {status === 'loading' && (
          <div className="min-h-[50vh] grid place-items-center">
            <Loader2 className="w-6 h-6 animate-spin text-ld-text-3" />
          </div>
        )}

        {status === 'error' && (
          <div className="min-h-[50vh] grid place-items-center">
            <StatePanel
              variant="error"
              icon={<FileQuestion className="w-6 h-6" />}
              title="Report not found"
              description="This share link is invalid or has been revoked by its owner."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link to="/">Go to PerfScope</Link>
                </Button>
              }
              className="w-full"
            />
          </div>
        )}

        {status === 'ready' && result && (
          <>
            <div className="flex items-center gap-2 mb-6 text-[13px] text-ld-text-2">
              {result.formFactor === 'mobile'
                ? <Smartphone className="w-4 h-4 text-ld-text-3" />
                : <Monitor className="w-4 h-4 text-ld-text-3" />}
              Read-only report shared from PerfScope · audited {new Date(result.timestamp).toLocaleString('en-US')}
            </div>
            <AnalyzerResultsPanel data={result} />
          </>
        )}
      </main>
    </div>
  );
}
