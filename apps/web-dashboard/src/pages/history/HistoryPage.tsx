import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GitCompareArrows, TrendingUp } from 'lucide-react';
import { useHistory, useAllHistory, fetchHistoryResult } from '@/features/history/model/useHistory';
import type { HistoryEntry } from '@/entities/history';
import { getHostname } from '@/entities/website';
import { computeRows } from '@/features/history/lib/computeRows';
import { RegressionHistory } from '@/features/history/ui/RegressionHistory';
import { CompareHistoryPanel } from '@/features/compare-history/ui/CompareHistoryPanel';
import { useAnalysisStore } from '@/features/analyzer/model/analysisStore';
import type { HistoryTab, StatusFilter, SortKey, SortOrder } from '@/features/history/model/types';
import { HistoryBreadcrumb } from '@/features/history/ui/HistoryBreadcrumb';
import { HistoryTabBar } from '@/features/history/ui/HistoryTabBar';
import { HistoryPageHeader } from '@/features/history/ui/HistoryPageHeader';
import { HistoryDeepDiveTable } from '@/features/history/ui/HistoryDeepDiveTable';
import { HistoryEmptyState } from '@/features/history/ui/HistoryEmptyState';
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
    <div className="w-[min(1120px,100%)] mx-auto px-[clamp(22px,4vw,48px)] pt-[30px] pb-[80px] flex flex-col gap-[22px]">

      {/* ── Top bar: breadcrumb ────────────────────────── */}
      {tab === 'analysis'
        ? <HistoryBreadcrumb hostname={hostname} />
        : (
          <nav className="flex items-center gap-[10px] text-[14px]">
            <span className="font-semibold text-ld-text">History</span>
            <span className="text-ld-text-3 opacity-50 text-[16px] leading-none">›</span>
            <span className="inline-flex items-center gap-[7px] font-semibold text-ld-text">
              <GitCompareArrows className="w-[16px] h-[16px] text-ld-accent" />
              Compare
            </span>
          </nav>
        )
      }

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
              <HistoryWebsitesOverview allEntries={allEntries} isLoading={allLoading} />
            ) : (
              <>
                {urlLoading && (
                  <div className="flex items-center justify-center py-28">
                    <div className="w-6 h-6 rounded-full border-2 border-ld-border-strong border-t-ld-accent animate-spin" />
                  </div>
                )}

                {!urlLoading && urlEntries.length === 0 && (
                  <HistoryEmptyState url={url} />
                )}

                {!urlLoading && urlEntries.length > 0 && (
                  <>
                    {/* Header card + evolution chart — one visual card */}
                    <div className="rounded-[20px] border border-ld-border bg-ld-surface overflow-hidden shadow-ld-shadow-card">
                      <HistoryPageHeader url={url} entries={urlEntries} />
                      <RegressionHistory entries={urlEntries} />
                    </div>

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
  );
}
