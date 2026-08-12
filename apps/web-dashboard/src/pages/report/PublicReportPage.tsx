import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Activity, Loader2, FileQuestion, Monitor, Smartphone } from 'lucide-react';
import { fetchJson } from '@/shared/api/client';
import { ThemeToggle } from '@/shared/ui/theme/ThemeToggle';
import { Button } from '@/shared/ui/button';
import { AnalyzerResultsPanel } from '@/widgets/analyzer-results';
import type { AnalysisResult } from '@/entities/analysis';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; result: AnalysisResult };

/** Read-only audit report behind an unguessable share token — no login required. */
export function PublicReportPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!token) { setState({ status: 'error' }); return; }
    fetchJson<AnalysisResult>(`/public/report/${token}`)
      .then(result => setState({ status: 'ready', result }))
      .catch(() => setState({ status: 'error' }));
  }, [token]);

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
        {state.status === 'loading' && (
          <div className="min-h-[50vh] grid place-items-center">
            <Loader2 className="w-6 h-6 animate-spin text-ld-text-3" />
          </div>
        )}

        {state.status === 'error' && (
          <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
            <span className="w-12 h-12 rounded-[14px] grid place-items-center bg-ld-surface-2 border border-ld-border">
              <FileQuestion className="w-6 h-6 text-ld-text-3" />
            </span>
            <div>
              <p className="text-[17px] font-bold text-ld-text">Report not found</p>
              <p className="text-[14px] text-ld-text-2 mt-1">
                This share link is invalid or has been revoked by its owner.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/">Go to PerfScope</Link>
            </Button>
          </div>
        )}

        {state.status === 'ready' && (
          <>
            <div className="flex items-center gap-2 mb-6 text-[13px] text-ld-text-2">
              {state.result.formFactor === 'mobile'
                ? <Smartphone className="w-4 h-4 text-ld-text-3" />
                : <Monitor className="w-4 h-4 text-ld-text-3" />}
              Read-only report shared from PerfScope · audited {new Date(state.result.timestamp).toLocaleString('en-US')}
            </div>
            <AnalyzerResultsPanel data={state.result} />
          </>
        )}
      </main>
    </div>
  );
}
