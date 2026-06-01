import { Link } from 'react-router-dom';
import { Activity, ExternalLink } from 'lucide-react';

export function Footer() {
  return (
    <footer className="px-6 py-10" style={{ borderTop: '1px solid var(--ps-divider)' }}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
            <Activity className="w-2.5 h-2.5 text-white" />
          </div>
          <span style={{ fontFamily: 'var(--ps-font-mono)', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '-0.03em', lineHeight: 1 }}>
            <span style={{ color: '#e2e8f0' }}>Perf</span>
            <span style={{ background: 'linear-gradient(135deg,#8b5cf6 0%,#c084fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Scope
            </span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          {[{ href: '/app', label: 'Analyzer' }, { href: '/compare', label: 'Compare' }, { href: '/history', label: 'History' }].map(({ href, label }) => (
            <Link key={href} to={href} className="text-xs transition-colors duration-150" style={{ color: 'var(--ps-text-muted)' }}>
              {label}
            </Link>
          ))}
          <a href="https://github.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs" style={{ color: 'var(--ps-text-muted)' }}>
            GitHub <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
        <p className="text-xs" style={{ color: 'var(--ps-text-faint)', fontFamily: 'var(--ps-font-mono)' }}>
          © 2026 PerfScope · MIT License
        </p>
      </div>
    </footer>
  );
}
