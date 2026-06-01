import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import {
  Globe, Plus, Trash2, ExternalLink, Activity, PlayCircle,
  ArrowUpDown, ArrowUp, ArrowDown, Search, ShieldCheck, GitCompareArrows,
} from 'lucide-react';
import { useWebsites, type Website } from '@/features/dashboard/hooks/useWebsites';
import { AddWebsiteModal } from '@/features/dashboard/components/AddWebsiteModal';
import { usePrefetchStore } from '@/features/analyzer/model/prefetchStore';

const col = createColumnHelper<Website>();

export function WebsitesPage() {
  const navigate = useNavigate();
  const { websites, isLoading, remove } = useWebsites();

  const [modalOpen, setModalOpen] = useState(false);
  const [sorting,   setSorting]   = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  function quickAudit(url: string, id: string) {
    usePrefetchStore.getState().start(url);
    navigate(`/app?url=${encodeURIComponent(url)}&projectId=${id}`);
  }

  function startAudit(url: string, id: string) {
    navigate(`/app?prefill=${encodeURIComponent(url)}&projectId=${id}`);
  }

  function startCompare(url: string) {
    navigate(`/compare?url=${encodeURIComponent(url)}`);
  }

  const columns = useMemo(() => [
    col.accessor('name', {
      header: 'Website',
      cell: ({ row }) => {
        const site     = row.original;
        const hostname = new URL(site.url).hostname;
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--ps-accent-muted)' }}>
              <Globe className="w-3.5 h-3.5" style={{ color: 'var(--ps-accent)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--ps-text-heading)' }}>
                {site.name || hostname}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--ps-text-muted)' }}>
                {hostname}
              </p>
            </div>
          </div>
        );
      },
    }),
    col.accessor('url', {
      header: 'URL',
      cell: ({ getValue }) => (
        <span className="text-xs font-mono truncate block max-w-[220px]" style={{ color: 'var(--ps-text-muted)' }}>
          {getValue()}
        </span>
      ),
    }),
    col.accessor('session', {
      header: 'Session',
      enableSorting: false,
      cell: ({ getValue }) => {
        const session = getValue();
        if (!session) return <span className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>—</span>;
        return (
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
            <span className="text-xs" style={{ color: '#22c55e' }}>Saved</span>
          </div>
        );
      },
    }),
    col.accessor('createdAt', {
      header: 'Added',
      cell: ({ getValue }) => (
        <span className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>
          {new Date(getValue()).toLocaleDateString()}
        </span>
      ),
    }),
    col.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const site = row.original;
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => quickAudit(site.url, site._id)}
              title="Quick Audit — runs immediately"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'var(--ps-accent-muted)', color: 'var(--ps-accent)' }}
            >
              <Activity className="w-3 h-3" />
              <span>Quick Audit</span>
            </button>
            <button
              onClick={() => startCompare(site.url)}
              title="Compare — open compare page with this URL pre-filled"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'rgba(249,115,22,0.08)', color: 'var(--ps-text-secondary)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f97316'; (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.15)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ps-text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.08)'; }}
            >
              <GitCompareArrows className="w-3 h-3" />
              <span>Compare</span>
            </button>
            <button
              onClick={() => startAudit(site.url, site._id)}
              title="Start Audit — open analyzer with this URL"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--ps-text-secondary)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ps-text-heading)'; (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.14)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ps-text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)'; }}
            >
              <PlayCircle className="w-3 h-3" />
              <span>Start Audit</span>
            </button>
            <a
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open website"
              className="p-1.5 rounded-lg transition-all"
              style={{ color: 'var(--ps-text-muted)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-heading)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-muted)')}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => remove.mutate(site._id)}
              title="Remove website"
              className="p-1.5 rounded-lg transition-all"
              style={{ color: 'var(--ps-text-muted)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-regression)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-muted)')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      },
    }),
  ], [remove]); // eslint-disable-line react-hooks/exhaustive-deps

  const table = useReactTable({ // eslint-disable-line react-hooks/incompatible-library
    data:            websites,
    columns,
    state:           { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel:     getCoreRowModel(),
    getSortedRowModel:   getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--ps-text-heading)' }}>My Websites</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ps-text-muted)' }}>
            {websites.length} website{websites.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ps-btn-primary"
        >
          <Plus className="w-4 h-4" /> Add Website
        </button>
      </div>

      {/* Search bar — only if there are websites */}
      {!isLoading && websites.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: 'var(--ps-text-muted)' }} />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Filter websites…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl"
            style={{
              background:   'var(--ps-accent-muted)',
              border:       '1px solid var(--ps-panel-border)',
              color:        'var(--ps-text-heading)',
              outline:      'none',
            }}
          />
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse"
              style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && websites.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--ps-accent-muted)' }}>
            <Globe className="w-7 h-7" style={{ color: 'var(--ps-accent)' }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--ps-text-heading)' }}>No websites yet</p>
          <p className="text-xs mb-5" style={{ color: 'var(--ps-text-muted)' }}>
            Add your first website to start tracking performance
          </p>
          <button onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ps-btn-primary">
            <Plus className="w-4 h-4" /> Add Website
          </button>
        </div>
      )}

      {/* TanStack Table */}
      {!isLoading && websites.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ps-panel-border)' }}>
          <table className="w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} style={{ background: 'var(--ps-panel-bg)', borderBottom: '1px solid var(--ps-panel-border)' }}>
                  {hg.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted  = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider select-none"
                        style={{ color: 'var(--ps-text-muted)', cursor: canSort ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            sorted === 'asc'  ? <ArrowUp   className="w-3 h-3" /> :
                            sorted === 'desc' ? <ArrowDown className="w-3 h-3" /> :
                                               <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, idx) => {
                const isLast = idx === table.getRowModel().rows.length - 1;
                return (
                  <tr
                    key={row.id}
                    className="group cursor-pointer transition-colors duration-100"
                    style={{ background: 'var(--ps-panel-bg)', borderBottom: isLast ? 'none' : '1px solid var(--ps-panel-border)' }}
                    onClick={() => navigate(`/projects/${row.original._id}`)}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.04)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--ps-panel-bg)')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-sm"
                    style={{ color: 'var(--ps-text-muted)' }}>
                    No websites match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AddWebsiteModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
