import { useMemo, useState, useEffect } from 'react';
import { Spinner } from '@/shared/ui/spinner';
import { Page, PageHeader } from '@/shared/ui/page';
import { useAdviceContext } from '@/features/advisor';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useHistory, useAllHistory, fetchHistoryResult } from '@/entities/history';
import type { HistoryEntry } from '@/entities/history';
import { getHostname } from '@/entities/website';
import { computeRows } from '@/features/history';
import { HistoryEvolutionCard } from '@/features/history';
import { TrendForecastPanel } from '@/features/history';
import { CompareHistoryPanel } from '@/features/compare-history';
import { useAnalysisStore } from '@/features/analyzer';
import type { HistoryTab, StatusFilter, SortKey, SortOrder } from '@/features/history';
import { HistoryTabBar } from '@/features/history';
import { HistoryDeepDiveTable } from '@/features/history';
import { HistoryEmptyState } from '@/features/history';
import { HistoryWebsitesOverview } from '@/widgets/history-websites-overview';
import { QueryErrorPanel } from '@/shared/ui/state-panel';

export function HistoryPage() {
  const [params, setParams] = useSearchParams();

  const tab    = (params.get('tab')    ?? 'analysis') as HistoryTab;
  const url    = params.get('url')     ?? '';
  const status = (params.get('status') ?? 'all')  as StatusFilter;
  const sort   = (params.get('sort')   ?? 'date') as SortKey;
  const order  = (params.get('order')  ?? 'desc') as SortOrder;

  const { data: urlEntries = [], isLoading: urlLoading, isError: urlError, refetch: refetchUrl } = useHistory(url || null);
  const { data: allEntries = [], isLoading: allLoading, isError: allError, refetch: refetchAll } = useAllHistory();

  const allRows  = useMemo(() => computeRows(urlEntries), [urlEntries]);
  const hostname = getHostname(url, '');

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const navigate  = useNavigate();
  const setResult = useAnalysisStore(s => s.setResult);

  // Extension deep-link: /history?open=<analysisId>
  useEffect(() => {
    const openId = params.get('open');
    if (!openId) return;
    fetchHistoryResult(openId)
      .then(result => { setResult(result, result.url as string); navigate('/app'); })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-link is consumed once on mount
  }, []);

  async function handleOpenInAnalyzer(entry: HistoryEntry) {
    setLoadingId(entry.id);
    try {
      const result = await fetchHistoryResult(entry.id);
      setResult(result, entry.url);
      navigate('/app');
    } catch {
      // result not stored yet
    } finally {
      setLoadingId(null);
    }
  }

  function setTab(t: HistoryTab) {
    setParams(() => {
      const n = new URLSearchParams();
      if (t !== 'analysis') n.set('tab', t);
      return n;
    }, { replace: true });
  }

  function setParam(key: string, val: string) {
    setParams(p => { const n = new URLSearchParams(p); n.set(key, val); return n; }, { replace: true });
  }

  function handleStatus(s: StatusFilter) { setParam('status', s); }
  function handleSort(col: SortKey) {
    if (col === sort) {
      setParam('order', order === 'asc' ? 'desc' : 'asc');
    } else {
      setParams(p => {
        const n = new URLSearchParams(p);
        n.set('sort', col);
        n.set('order', col === 'score' ? 'desc' : 'asc');
        return n;
      }, { replace: true });
    }
  }

  // Only when the user has drilled into one site; the overview list is account-wide.
  useAdviceContext(url && hostname ? { scope: 'site', url, label: hostname } : null);

  return (
    <Page>
      {/* This page used to open with a breadcrumb and no title at all, which made it the
          only page in the app whose first line was 14px grey text. The hostname keeps its
          place as the subject when one site is selected. */}
      <PageHeader
        eyebrow="History"
        title={tab === 'analysis' && hostname ? hostname : 'Performance history'}
        description={tab === 'compare'
          ? 'Every comparison you have saved, newest first.'
          : hostname
            ? 'Every audit recorded for this site, newest last.'
            : 'Sites you have audited, and how their scores have moved.'}
      />

      <div className="flex flex-col gap-[22px]">
      {/* ── Tab bar ────────────────────────────────────── */}
      <HistoryTabBar active={tab} onChange={setTab} />

      {/* ── Content ────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {tab === 'analysis' && (
          <motion.div
            key="analysis"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-[22px]"
          >
            {!url ? (
              <HistoryWebsitesOverview
                allEntries={allEntries}
                isLoading={allLoading}
                isError={allError}
                onRetry={() => void refetchAll()}
              />
            ) : (
              <>
                {urlLoading && (
                  <div className="flex items-center justify-center py-28">
                    <Spinner />
                  </div>
                )}

                {/* Before the empty state: an unreachable backend is not "no audits yet". */}
                {!urlLoading && urlError && (
                  <QueryErrorPanel what={`history for ${hostname || 'this URL'}`} onRetry={() => void refetchUrl()} />
                )}

                {!urlLoading && !urlError && urlEntries.length === 0 && (
                  <HistoryEmptyState url={url} />
                )}

                {!urlLoading && !urlError && urlEntries.length > 0 && (
                  <>
                    <HistoryEvolutionCard url={url} entries={urlEntries} />

                    {/* Projects the same runs forward; renders nothing until there are enough. */}
                    <TrendForecastPanel url={url} entries={urlEntries} />

                    {/* Deep dive table */}
                    <HistoryDeepDiveTable
                      allRows={allRows}
                      status={status}
                      sort={sort}
                      order={order}
                      onStatus={handleStatus}
                      onSort={handleSort}
                      onOpen={handleOpenInAnalyzer}
                      loadingId={loadingId}
                    />
                  </>
                )}
              </>
            )}
          </motion.div>
        )}

        {tab === 'compare' && (
          <motion.div
            key="compare"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <CompareHistoryPanel />
          </motion.div>
        )}

      </AnimatePresence>
      </div>
    </Page>
  );
}
