import { useState }                 from 'react';
import { useDebounced }             from '@/shared/lib/useDebounced';
import {
  Globe, Plus, Loader2,
  LayoutGrid, List, Search,
  CheckSquare, Gauge, AlertTriangle, Layers,
} from 'lucide-react';
import { Button }                    from '@/shared/ui/button';
import { Input }                     from '@/shared/ui/input';
import { Segmented }                 from '@/shared/ui/segmented';
import { Page, PageHeader }          from '@/shared/ui/page';
import { StatePanel, QueryErrorPanel } from '@/shared/ui/state-panel';
import { StatCard }                  from '@/shared/ui/stat-card';
import { useWebsites }              from '@/entities/website';
import { BAND_TILE, BAND_TEXT }     from '@/entities/analysis';
import { useWebsitesPage, useWebsitesSummary } from '@/features/websites';
import { useWebsiteScores }         from '@/features/websites';
import { useWebsiteActions }        from '@/features/websites';
import { AddWebsiteModal }          from '@/features/websites';
import { DeleteWebsiteModal }       from '@/features/websites';
import { WebsiteCard }              from './ui/WebsiteCard';
import { Pagination }               from './ui/Pagination';
import type { Website }             from '@/entities/website';

const PAGE_SIZE = 12;

// ── Local summary tile ────────────────────────────────────────────────────────
// A thin adapter over the shared StatCard — this page had re-implemented the whole
// tile with its own (slightly drifted) padding and type scale. Only the variant→band
// class mapping is local; the markup is the shared one.

type SumVariant = 'default' | 'good' | 'warn';

function SumCard({ icon, value, label, variant = 'default' }: {
  icon:     React.ReactNode;
  value:    number | string;
  label:    string;
  variant?: SumVariant;
}) {
  return (
    <StatCard
      icon={icon}
      value={value}
      label={label}
      {...(variant !== 'default' ? { iconClassName: BAND_TILE[variant], valueClassName: BAND_TEXT[variant] } : {})}
    />
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function WebsitesPage() {
  const { remove }                   = useWebsites();
  const { getInfo }                  = useWebsiteScores();
  const { quickAudit, startCompare } = useWebsiteActions();

  const [modalOpen,     setModalOpen]     = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Website | null>(null);
  const [search,        setSearch]        = useState('');
  const [page,          setPage]          = useState(1);
  const [view,          setView]          = useState<'grid' | 'list'>(() =>
    (localStorage.getItem('ps-websites-view') as 'grid' | 'list') ?? 'grid'
  );

  // Debounced so typing doesn't fire a request per keystroke.
  const debouncedQ = useDebounced(search.trim());

  // A new filter invalidates the current page number. Adjusted during the render that
  // first sees the new query rather than in an effect afterwards: the effect version
  // rendered page 3 of the new result set for one frame before resetting it.
  const [pagedQ, setPagedQ] = useState(debouncedQ);
  if (pagedQ !== debouncedQ) {
    setPagedQ(debouncedQ);
    setPage(1);
  }

  const { data: pageData, isPending, isFetching, isError, refetch } = useWebsitesPage({
    q: debouncedQ, page, limit: PAGE_SIZE,
  });
  const { data: summary } = useWebsitesSummary();

  const items      = pageData?.items ?? [];
  const totalPages = pageData?.totalPages ?? 1;
  const total      = pageData?.total ?? 0;
  const isLoading  = isPending;
  const isFiltering = debouncedQ.length > 0;
  // A failed request leaves `total` at its 0 fallback, which is indistinguishable from an
  // account with no websites. Everything below branches on this first so the user is never
  // told they have no sites when the truth is that we could not ask.
  const failed = isError && !pageData;

  function switchView(v: 'grid' | 'list') {
    setView(v);
    localStorage.setItem('ps-websites-view', v);
  }

  return (
    <Page>
      {/* No "Add website" action here: the sidebar carries it on every page, and having
          both put two identical primary buttons on screen at once, competing. */}
      <PageHeader
        eyebrow="My websites"
        title={<>
          Your websites{' '}
          <em className="not-italic font-bold text-ld-text-3">
            · {summary?.total ?? total} tracked
          </em>
        </>}
        description="Audit, compare and keep an eye on every site in one place."
      />

      {/* ── Summary strip — account-wide counts from the server. Independent of
             the filter, so it stays put even when a search matches nothing ─ */}
      {summary && summary.total > 0 && (
        <div className="grid grid-cols-4 gap-[14px] mb-[26px] max-sm:grid-cols-2 max-[520px]:grid-cols-1">
          <SumCard icon={<Layers        className="w-[19px] h-[19px]" />} value={summary.total}   label="Total sites" />
          <SumCard icon={<CheckSquare   className="w-[19px] h-[19px]" />} value={summary.audited} label="Audited" variant="good" />
          <SumCard icon={<Gauge         className="w-[19px] h-[19px]" />} value={summary.audited ? summary.avgScore : '—'} label="Avg score" />
          <SumCard icon={<AlertTriangle className="w-[19px] h-[19px]" />} value={summary.needsAttention} label="Needs attention" variant={summary.needsAttention > 0 ? 'warn' : 'default'} />
        </div>
      )}

      {/* ── Toolbar — stays mounted while filtering so an empty result set
             can still be cleared ──────────────────────────────────────── */}
      {!isLoading && !failed && (total > 0 || isFiltering) && (
        <div className="flex items-center gap-3 mb-[18px] flex-wrap">
          <Input
            icon={<Search />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search websites…"
            wrapperClassName="flex-1 min-w-[220px]"
          />

          {/* Grid / List toggle */}
          <Segmented
            ariaLabel="View mode"
            value={view}
            onChange={switchView}
            options={[
              { value: 'grid', label: 'Grid', icon: LayoutGrid },
              { value: 'list', label: 'List', icon: List },
            ]}
          />
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-ld-accent" />
        </div>
      )}

      {/* ── Request failed — never fall through to the empty state ─────── */}
      {!isLoading && failed && (
        <QueryErrorPanel what="your websites" onRetry={() => void refetch()} isRetrying={isFetching} />
      )}

      {/* ── Empty state (no websites at all) ───────────────────────────── */}
      {!isLoading && !failed && total === 0 && !isFiltering && (
        <StatePanel
          icon={<Globe className="w-6 h-6" />}
          title="No websites yet"
          description="Add your first website to start tracking performance."
          action={
            <Button size="md" onClick={() => setModalOpen(true)}>
              <Plus /> Add Website
            </Button>
          }
        />
      )}

      {/* ── Cards grid / list ──────────────────────────────────────────── */}
      {!isLoading && items.length > 0 && (
        <>
          <div className={`grid gap-4 transition-opacity duration-200 ${isFetching ? 'opacity-60' : ''} ${
            view === 'grid' ? 'grid-cols-2 max-[860px]:grid-cols-1' : 'grid-cols-1'
          }`}>
            {items.map(site => (
              <WebsiteCard
                key={site._id}
                site={site}
                scoreInfo={getInfo(site.url)}
                isList={view === 'list'}
                onAnalyze={() => quickAudit(site.url, site._id)}
                onCompare={() => startCompare(site.url)}
                onDelete={() => setPendingDelete(site)}
              />
            ))}
          </div>

          <Pagination
            page={pageData?.page ?? page}
            totalPages={totalPages}
            total={total}
            limit={PAGE_SIZE}
            onChange={setPage}
          />
        </>
      )}

      {/* ── No search results ──────────────────────────────────────────── */}
      {!isLoading && !failed && items.length === 0 && isFiltering && (
        <StatePanel title={`No websites match “${debouncedQ}”.`} />
      )}

      <AddWebsiteModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <DeleteWebsiteModal
        open={!!pendingDelete}
        name={pendingDelete?.name}
        url={pendingDelete?.url ?? ''}
        isPending={remove.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          remove.mutate(pendingDelete._id, { onSettled: () => setPendingDelete(null) });
        }}
        onClose={() => setPendingDelete(null)}
      />
    </Page>
  );
}
