import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GitCompareArrows } from 'lucide-react';
import { ThemeToggle } from '@/shared/ui/theme/ThemeToggle';
import { useHistory, useAllHistory, fetchHistoryResult } from '@/features/history/hooks/useHistory';
import type { HistoryEntry } from '@/entities/history';
import { computeRows } from '@/features/history/lib/computeRows';
import { RegressionHistory } from '@/features/history/components/RegressionHistory';
import { CompareHistoryPanel } from '@/features/compare-history/components/CompareHistoryPanel';
import { useAnalysisStore } from '@/features/analyzer/model/analysisStore';
import type { HistoryTab, StatusFilter, SortKey, SortOrder } from '@/features/history/model/types';
import { HistoryBreadcrumb } from '@/features/history/components/HistoryBreadcrumb';
import { HistoryTabBar } from '@/features/history/components/HistoryTabBar';
import { HistoryPageHeader } from '@/features/history/components/HistoryPageHeader';
import { HistoryDeepDiveTable } from '@/features/history/components/HistoryDeepDiveTable';
import { HistoryEmptyState } from '@/features/history/components/HistoryEmptyState';
import { HistoryWebsitesOverview } from '@/widgets/history-websites-overview';

export function HistoryPage() {
  const [params, setParams] = useSearchParams();

  const tab    = (params.get('tab')    ?? 'analysis') as HistoryTab;
  const url    = params.get('url')     ?? '';
  const status = (params.get('status') ?? 'all')  as StatusFilter;
  const sort   = (params.get('sort')   ?? 'date') as SortKey;
  const order  = (params.get('order')  ?? 'desc') as SortOrder;

  const { data: urlEntries = [], isLoading: urlLoading } = useHistory(url || null);
  const { data: allEntries = [], isLoading: allLoading  } = useAllHistory();

  const allRows  = useMemo(() => computeRows(urlEntries), [urlEntries]);
  const hostname = (() => { try { return new URL(url).hostname; } catch { return ''; } })();

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const navigate  = useNavigate();
  const setResult = useAnalysisStore(s => s.setResult);

  // Extension deep-link: /history?open=<analysisId>
  useEffect(() => {
    const openId = params.get('open');
    if (!openId) return;
    fetchHistoryResult(openId)
      .then(result => {
        setResult(result, result.url as string);
        navigate('/app');
      })
      .catch(() => undefined);
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
    setParams(_ => {
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

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {tab === 'analysis'
          ? <HistoryBreadcrumb hostname={hostname} />
          : (
            <nav className="flex items-center gap-1.5 text-sm select-none">
              <span className="font-semibold text-ps-heading">History</span>
              <span className="text-ps-faint text-base">›</span>
              <div className="flex items-center gap-1.5">
                <GitCompareArrows className="w-3.5 h-3.5 text-ps-accent" />
                <span className="font-semibold text-ps-heading">Compare</span>
              </div>
            </nav>
          )
        }
        <ThemeToggle />
      </div>

      {/* Tab Bar */}
      <HistoryTabBar active={tab} onChange={setTab} />

      {/* Content */}
      <AnimatePresence mode="wait">

        {tab === 'analysis' && (
          <motion.div
            key="analysis"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {!url ? (
              <HistoryWebsitesOverview allEntries={allEntries} isLoading={allLoading} />
            ) : (
              <>
                {urlLoading && (
                  <div className="flex items-center justify-center py-28">
                    <div
                      className="w-6 h-6 rounded-full border-2 animate-spin"
                      style={{ borderColor: 'rgba(139,92,246,0.18)', borderTopColor: 'var(--ps-accent)' }}
                    />
                  </div>
                )}
                {!urlLoading && (
                  urlEntries.length === 0
                    ? <HistoryEmptyState url={url} />
                    : (
                      <>
                        <HistoryPageHeader url={url} entries={urlEntries} />
                        <RegressionHistory entries={urlEntries} />
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
                    )
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
  );
}
