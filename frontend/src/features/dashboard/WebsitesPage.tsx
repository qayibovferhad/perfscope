import { useNavigate } from 'react-router-dom';
import { Globe, Plus, Trash2, ExternalLink, Activity } from 'lucide-react';
import { useWebsites } from './useWebsites';
import { AddWebsiteModal } from './AddWebsiteModal';
import { useState } from 'react';
import { usePrefetchStore } from '@/store/prefetchStore';

export function WebsitesPage() {
  const navigate = useNavigate();
  const { websites, isLoading, remove } = useWebsites();
  const [modalOpen, setModalOpen] = useState(false);

  function handleAuditHover(url: string) {
    usePrefetchStore.getState().start(url);
  }

  function runAudit(url: string) {
    navigate(`/app?url=${encodeURIComponent(url)}`);
  }

  function openProject(id: string) {
    navigate(`/projects/${id}`);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--ps-text-heading)' }}>
            My Websites
          </h1>
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

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl animate-pulse"
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
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ps-btn-primary"
          >
            <Plus className="w-4 h-4" /> Add Website
          </button>
        </div>
      )}

      {/* Grid */}
      {!isLoading && websites.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {websites.map((site) => {
            const hostname = new URL(site.url).hostname;
            return (
              <div key={site._id}
                className="group relative flex flex-col gap-3 p-4 rounded-2xl cursor-pointer transition-all duration-150"
                style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }}
                onClick={() => openProject(site._id)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--ps-accent-border)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--ps-panel-border)'; }}
              >
                {/* Icon + domain */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--ps-accent-muted)' }}>
                    <Globe className="w-4 h-4" style={{ color: 'var(--ps-accent)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--ps-text-heading)' }}>
                      {site.name || hostname}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--ps-text-muted)' }}>
                      {hostname}
                    </p>
                  </div>
                </div>

                {/* Full URL */}
                <p className="text-[11px] truncate px-0.5" style={{ color: 'var(--ps-text-muted)' }}>
                  {site.url}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); runAudit(site.url); }}
                    onMouseEnter={(e) => { handleAuditHover(site.url); (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-1 justify-center transition-all"
                    style={{ background: 'var(--ps-accent-muted)', color: 'var(--ps-accent)' }}
                    title="Quick audit (no project tracking)"
                  >
                    <Activity className="w-3 h-3" /> Quick Audit
                  </button>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg transition-all"
                    style={{ color: 'var(--ps-text-muted)' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-heading)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-muted)')}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove.mutate(site._id); }}
                    className="p-1.5 rounded-lg transition-all"
                    style={{ color: 'var(--ps-text-muted)' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-regression)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-muted)')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Added date */}
                <p className="text-[10px]" style={{ color: 'var(--ps-text-muted)' }}>
                  Added {new Date(site.createdAt).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <AddWebsiteModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
