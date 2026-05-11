import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Search, GitCompareArrows,
  History, GitBranch, LogOut, Menu, X, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV = [
  { to: '/app',             icon: <Search          className="w-4 h-4" />, label: 'Analyzer'        },
  { to: '/compare',         icon: <GitCompareArrows className="w-4 h-4" />, label: 'Compare'         },
  { to: '/history',         icon: <History         className="w-4 h-4" />, label: 'History'          },
  { to: '/compare-history', icon: <GitBranch       className="w-4 h-4" />, label: 'Compare History'  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const navigate  = useNavigate();
  const { user, logout } = useAuthStore();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside
      className="flex flex-col h-full w-64"
      style={{
        background:   'rgba(7,12,26,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRight:  '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Logo row */}
      <div
        className="flex items-center justify-between px-5 h-14 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Link to="/" className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              boxShadow:  '0 0 12px rgba(139,92,246,0.4)',
            }}
          >
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <span
            style={{
              fontFamily:    'var(--ps-font-mono)',
              fontWeight:    800,
              fontSize:      '1rem',
              letterSpacing: '-0.04em',
              lineHeight:    1,
            }}
          >
            <span style={{ color: '#e2e8f0' }}>Perf</span>
            <span
              style={{
                background:           'linear-gradient(135deg,#8b5cf6,#c084fc)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor:  'transparent',
                backgroundClip:       'text',
              }}
            >
              Scope
            </span>
          </span>
        </Link>

        {onClose && (
          <button onClick={onClose} style={{ color: 'var(--ps-text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p
          className="px-3 mb-2 text-[9px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--ps-text-muted)' }}
        >
          Workspace
        </p>
        {NAV.map(({ to, icon, label }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group"
              style={{
                background: active
                  ? 'rgba(139,92,246,0.14)'
                  : 'transparent',
                border: active
                  ? '1px solid rgba(139,92,246,0.22)'
                  : '1px solid transparent',
                color: active
                  ? '#a78bfa'
                  : 'var(--ps-text-secondary)',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--ps-text-heading)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--ps-text-secondary)';
                }
              }}
            >
              <span style={{ color: active ? '#8b5cf6' : 'inherit' }}>{icon}</span>
              <span className="text-sm font-medium flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div
        className="px-3 py-3 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="w-7 h-7 rounded-full shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff' }}
            >
              {user?.name?.[0] ?? 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-semibold truncate"
              style={{ color: 'var(--ps-text-heading)' }}
            >
              {user?.name}
            </p>
            <p className="text-[10px] truncate" style={{ color: 'var(--ps-text-muted)' }}>
              {user?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="shrink-0 p-1 rounded transition-colors duration-150"
            style={{ color: 'var(--ps-text-muted)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-muted)')}
          >
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

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--ps-page-bg)' }}>

      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden"
              style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed left-0 top-0 bottom-0 z-50 md:hidden"
            >
              <Sidebar onClose={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div
          className="md:hidden flex items-center gap-3 px-4 h-14 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            style={{ color: 'var(--ps-text-secondary)' }}
          >
            <Menu className="w-5 h-5" />
          </button>
          <span
            style={{
              fontFamily:    'var(--ps-font-mono)',
              fontWeight:    800,
              fontSize:      '1rem',
              letterSpacing: '-0.04em',
            }}
          >
            <span style={{ color: '#e2e8f0' }}>Perf</span>
            <span
              style={{
                background:           'linear-gradient(135deg,#8b5cf6,#c084fc)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor:  'transparent',
                backgroundClip:       'text',
              }}
            >
              Scope
            </span>
          </span>
        </div>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
