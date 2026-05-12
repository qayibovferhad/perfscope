import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Search, GitCompareArrows, History,
  LogOut, Menu, X, ChevronRight, Plus, Globe, Trash2, LayoutGrid,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useWebsites } from './useWebsites';
import { useAllHistory } from '../history/hooks/useHistory';
import { AddWebsiteModal } from './AddWebsiteModal';

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV = [
  { to: '/app',             icon: <Search           className="w-4 h-4" />, label: 'Analyzer'       },
  { to: '/compare',         icon: <GitCompareArrows className="w-4 h-4" />, label: 'Compare'        },
  { to: '/history',              icon: <History  className="w-4 h-4" />, label: 'History'        },
  { to: '/websites',        icon: <LayoutGrid       className="w-4 h-4" />, label: 'My Websites'    },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ onClose, onAddWebsite }: { onClose?: () => void; onAddWebsite: () => void }) {
  const location = useLocation();
  const navigate  = useNavigate();
  const { user, logout } = useAuthStore();
  const { websites, remove } = useWebsites();
  const { data: allHistory = [] } = useAllHistory();

  const sortedWebsites = useMemo(() => {
    if (!allHistory.length) return websites;
    const lastAuditAt: Record<string, number> = {};
    for (const entry of allHistory) {
      const t = new Date(entry.timestamp).getTime();
      if (!lastAuditAt[entry.url] || t > lastAuditAt[entry.url]) {
        lastAuditAt[entry.url] = t;
      }
    }
    return [...websites].sort((a, b) => {
      const ta = lastAuditAt[a.url] ?? 0;
      const tb = lastAuditAt[b.url] ?? 0;
      return tb - ta;
    });
  }, [websites, allHistory]);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function runAudit(url: string) {
    onClose?.();
    navigate(`/app?url=${encodeURIComponent(url)}`);
  }

  return (
    <aside className="flex flex-col h-full w-64"
      style={{ background: 'rgba(7,12,26,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRight: '1px solid var(--ps-divider)' }}>

      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-14 shrink-0" style={{ borderBottom: '1px solid var(--ps-divider)' }}>
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 12px var(--ps-accent-glow-sm)' }}>
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <span style={{ fontFamily: 'var(--ps-font-mono)', fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.04em', lineHeight: 1 }}>
            <span style={{ color: 'var(--ps-text-heading)' }}>Perf</span>
            <span style={{ background: 'linear-gradient(135deg,var(--ps-accent),#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Scope</span>
          </span>
        </Link>
        {onClose && <button onClick={onClose} style={{ color: 'var(--ps-text-muted)' }}><X className="w-4 h-4" /></button>}
      </div>

      {/* Add Website button */}
      <div className="px-3 pt-4 pb-2">
        <button onClick={() => { onAddWebsite(); onClose?.(); }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold ps-btn-primary">
          <Plus className="w-4 h-4" /> Add Website
        </button>
      </div>

      {/* Saved websites */}
      {sortedWebsites.length > 0 && (
        <div className="px-3 pb-2">
          <p className="px-3 mb-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--ps-text-muted)' }}>
            My Websites
          </p>
          <div className="space-y-0.5">
            {sortedWebsites.slice(0, 3).map((site) => (
              <div key={site._id}
                className="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
                style={{ border: '1px solid transparent', transition: 'background 0.15s, border-color 0.15s' }}
                onClick={() => runAudit(site.url)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--ps-panel-border)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
              >
                <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                  style={{ background: 'var(--ps-accent-muted)' }}>
                  <Globe className="w-2.5 h-2.5" style={{ color: 'var(--ps-accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--ps-text-heading)' }}>
                    {site.name || new URL(site.url).hostname}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--ps-text-muted)' }}>
                    {new URL(site.url).hostname}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); remove.mutate(site._id); }}
                  title="Remove"
                  className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--ps-text-muted)' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-regression)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-muted)')}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          {sortedWebsites.length > 3 && (
            <Link to="/websites" onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 mt-1 rounded-lg text-[11px] font-medium transition-all"
              style={{ color: 'var(--ps-accent)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--ps-accent-muted)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            >
              <ChevronRight className="w-3 h-3" />
              View all {sortedWebsites.length} websites
            </Link>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto" style={{ borderTop: websites.length > 0 ? '1px solid var(--ps-divider)' : 'none' }}>
        <p className="px-3 mb-2 text-[9px] font-bold uppercase tracking-widest mt-2" style={{ color: 'var(--ps-text-muted)' }}>
          Workspace
        </p>
        {NAV.map(({ to, icon, label }) => {
          const active = location.pathname === to;
          return (
            <Link key={to} to={to} onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150"
              style={{
                background: active ? 'var(--ps-accent-hover)' : 'transparent',
                border:     active ? '1px solid var(--ps-accent-border)' : '1px solid transparent',
                color:      active ? 'var(--ps-accent)' : 'var(--ps-text-secondary)',
              }}
              onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'var(--ps-text-heading)'; } }}
              onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--ps-text-secondary)'; } }}>
              <span style={{ color: active ? 'var(--ps-accent)' : 'inherit' }}>{icon}</span>
              <span className="text-sm font-medium flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 shrink-0" style={{ borderTop: '1px solid var(--ps-divider)' }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--ps-panel-border)' }}>
          {user?.picture
            ? <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full shrink-0" referrerPolicy="no-referrer" />
            : <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff' }}>
                {user?.name?.[0] ?? 'U'}
              </div>
          }
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--ps-text-heading)' }}>{user?.name}</p>
            <p className="text-[10px] truncate" style={{ color: 'var(--ps-text-muted)' }}>{user?.email}</p>
          </div>
          <button onClick={handleLogout} title="Sign out" className="shrink-0 p-1 rounded"
            style={{ color: 'var(--ps-text-muted)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-regression)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-muted)')}>
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Dashboard Layout ─────────────────────────────────────────────────────────

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--ps-page-bg)' }}>

      <div className="hidden md:flex shrink-0">
        <Sidebar onAddWebsite={() => setModalOpen(true)} />
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden" style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: -256 }} animate={{ x: 0 }} exit={{ x: -256 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed left-0 top-0 bottom-0 z-50 md:hidden">
              <Sidebar onClose={() => setMobileOpen(false)} onAddWebsite={() => setModalOpen(true)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AddWebsiteModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="md:hidden flex items-center gap-3 px-4 h-14 shrink-0"
          style={{ borderBottom: '1px solid var(--ps-divider)' }}>
          <button onClick={() => setMobileOpen(true)} style={{ color: 'var(--ps-text-secondary)' }}>
            <Menu className="w-5 h-5" />
          </button>
          <span style={{ fontFamily: 'var(--ps-font-mono)', fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.04em' }}>
            <span style={{ color: 'var(--ps-text-heading)' }}>Perf</span>
            <span style={{ background: 'linear-gradient(135deg,var(--ps-accent),#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Scope</span>
          </span>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
