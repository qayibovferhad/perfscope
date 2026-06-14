import { useState, useMemo }        from 'react';
import {
  Globe, Plus, Loader2,
  LayoutGrid, List, Search,
  CheckSquare, Gauge, AlertTriangle, Layers,
} from 'lucide-react';
import { Input }                     from '@/shared/ui/input';
import { useWebsites }              from '@/features/dashboard/hooks/useWebsites';
import { useWebsiteScores }         from '@/features/websites/model/useWebsiteScores';
import { useWebsiteActions }        from '@/features/websites/model/useWebsiteActions';
import { AddWebsiteModal }          from '@/features/websites/ui/AddWebsiteModal';
import { WebsiteCard }              from './ui/WebsiteCard';

// ── Local summary tile ────────────────────────────────────────────────────────

type SumVariant = 'default' | 'good' | 'warn';

function SumCard({ icon, value, label, variant = 'default' }: {
  icon:     React.ReactNode;
  value:    number | string;
  label:    string;
  variant?: SumVariant;
}) {
  const iconCls: Record<SumVariant, string> = {
    default: 'bg-ld-surface-2 border-ld-border text-ld-accent',
    good:    'bg-ld-accent-soft border-ld-accent-line text-ld-accent',
    warn:    'bg-[rgba(230,162,60,0.10)] border-[rgba(230,162,60,0.30)] text-ld-amber',
  };
  const valueCls: Record<SumVariant, string> = {
    default: 'text-ld-text',
    good:    'text-ld-score-good',
    warn:    'text-ld-amber',
  };
  return (
    <div className="flex items-center gap-[13px] px-[18px] py-4 rounded-[15px] border border-ld-border bg-ld-surface
                    transition-[border-color,transform] duration-[250ms] hover:border-ld-accent-line hover:-translate-y-[2px]">
      <div className={`w-10 h-10 rounded-[11px] grid place-items-center shrink-0 border ${iconCls[variant]}`}>
        {icon}
      </div>
      <div>
        <b className={`font-mono text-[22px] font-semibold tracking-[-0.02em] leading-none block ${valueCls[variant]}`}>
          {value}
        </b>
        <span className="text-[12.5px] text-ld-text-3 mt-[5px] block">{label}</span>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function WebsitesPage() {
  const { websites, isLoading, remove } = useWebsites();
  const { getInfo }                     = useWebsiteScores();
  const { quickAudit, startCompare }    = useWebsiteActions();

  const [modalOpen, setModalOpen] = useState(false);
  const [search,    setSearch]    = useState('');
  const [view,      setView]      = useState<'grid' | 'list'>(() =>
    (localStorage.getItem('ps-websites-view') as 'grid' | 'list') ?? 'grid'
  );

  function switchView(v: 'grid' | 'list') {
    setView(v);
    localStorage.setItem('ps-websites-view', v);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return websites;
    return websites.filter(w =>
      (w.name ?? '').toLowerCase().includes(q) || w.url.toLowerCase().includes(q)
    );
  }, [websites, search]);

  // Summary stats
  const audited   = websites.filter(w => getInfo(w.url).latestScore !== null);
  const avgScore  = audited.length > 0
    ? Math.round(audited.reduce((s, w) => s + (getInfo(w.url).latestScore ?? 0), 0) / audited.length)
    : 0;
  const needsAttn = websites.filter(w => {
    const s = getInfo(w.url).latestScore;
    return s !== null && s < 50;
  }).length;

  return (
    <div className="px-[clamp(22px,4vw,48px)] py-[34px] pb-20 w-[min(1180px,100%)] mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-5 flex-wrap mb-[26px]">
        <div>
          <p className="font-mono text-[12px] tracking-[.16em] uppercase text-ld-accent font-semibold">
            Welcome back
          </p>
          <h1 className="text-[clamp(26px,3.4vw,34px)] font-extrabold tracking-[-0.03em] mt-2 text-ld-text">
            Your websites{' '}
            <em className="not-italic font-bold text-ld-text-3">
              · {websites.length} tracked
            </em>
          </h1>
          <p className="text-[14.5px] text-ld-text-2 mt-[6px]">
            Audit, compare and keep an eye on every site in one place.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-[9px] font-bold text-[14.5px] px-5 py-3 rounded-[12px]
                     bg-ld-grad text-ld-grad-text shadow-ld-glow border-0
                     transition-transform duration-[150ms] hover:-translate-y-px"
        >
          <Plus className="w-[17px] h-[17px]" /> Add Website
        </button>
      </div>

      {/* ── Summary strip ──────────────────────────────────────────────── */}
      {!isLoading && websites.length > 0 && (
        <div className="grid grid-cols-4 gap-[14px] mb-[26px] max-sm:grid-cols-2 max-[520px]:grid-cols-1">
          <SumCard icon={<Layers    className="w-[19px] h-[19px]" />} value={websites.length} label="Total sites" />
          <SumCard icon={<CheckSquare className="w-[19px] h-[19px]" />} value={audited.length} label="Audited" variant="good" />
          <SumCard icon={<Gauge     className="w-[19px] h-[19px]" />} value={audited.length ? avgScore : '—'} label="Avg score" />
          <SumCard icon={<AlertTriangle className="w-[19px] h-[19px]" />} value={needsAttn} label="Needs attention" variant={needsAttn > 0 ? 'warn' : 'default'} />
        </div>
      )}

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      {!isLoading && websites.length > 0 && (
        <div className="flex items-center gap-3 mb-[18px] flex-wrap">
          <Input
            icon={<Search />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search websites…"
            wrapperClassName="flex-1 min-w-[220px]"
          />

          {/* Grid / List toggle */}
          <div className="flex gap-[3px] p-[3px] rounded-[11px] border border-ld-border bg-ld-bg-2">
            {(['grid', 'list'] as const).map(v => (
              <button
                key={v}
                onClick={() => switchView(v)}
                className={`inline-flex items-center gap-[7px] text-[13px] font-medium px-[13px] py-2 rounded-[8px]
                            transition-all duration-200
                            ${view === v
                              ? 'bg-ld-surface text-ld-text font-semibold shadow-[0_1px_0_rgba(0,0,0,0.18)]'
                              : 'text-ld-text-2 hover:text-ld-text'}`}
              >
                {v === 'grid'
                  ? <><LayoutGrid className="w-[15px] h-[15px]" /> Grid</>
                  : <><List       className="w-[15px] h-[15px]" /> List</>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-ld-accent" />
        </div>
      )}

      {/* ── Empty state (no websites) ──────────────────────────────────── */}
      {!isLoading && websites.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-[16px] grid place-items-center mb-4 bg-ld-accent-soft">
            <Globe className="w-7 h-7 text-ld-accent" />
          </div>
          <p className="text-sm font-semibold text-ld-text mb-1">No websites yet</p>
          <p className="text-xs text-ld-text-3 mb-5">Add your first website to start tracking performance.</p>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[11px] text-sm font-semibold
                       bg-ld-grad text-ld-grad-text shadow-ld-glow"
          >
            <Plus className="w-4 h-4" /> Add Website
          </button>
        </div>
      )}

      {/* ── Cards grid / list ──────────────────────────────────────────── */}
      {!isLoading && filtered.length > 0 && (
        <div className={`grid gap-4 ${view === 'grid' ? 'grid-cols-2 max-[860px]:grid-cols-1' : 'grid-cols-1'}`}>
          {filtered.map(site => (
            <WebsiteCard
              key={site._id}
              site={site}
              scoreInfo={getInfo(site.url)}
              isList={view === 'list'}
              onAnalyze={() => quickAudit(site.url, site._id)}
              onCompare={() => startCompare(site.url)}
              onDelete={() => remove.mutate(site._id)}
            />
          ))}
        </div>
      )}

      {/* ── No search results ──────────────────────────────────────────── */}
      {!isLoading && websites.length > 0 && filtered.length === 0 && (
        <p className="text-center text-[14px] text-ld-text-3 py-10">
          No websites match your search.
        </p>
      )}

      <AddWebsiteModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
