import { Link } from 'react-router-dom';
import { Activity, ExternalLink } from 'lucide-react';

export function Footer() {
  return (
    <footer className="px-6 py-10 border-t border-ps-divider">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md flex items-center justify-center bg-ps-brand">
            <Activity className="w-2.5 h-2.5 text-white" />
          </div>
          <span className="font-mono font-bold text-[0.9rem] tracking-[-0.03em] leading-none">
            <span className="text-slate-200">Perf</span>
            <span className="ps-logo-gradient">Scope</span>
          </span>
        </div>

        <div className="flex items-center gap-6">
          {[
            { href: '/app',     label: 'Analyzer' },
            { href: '/compare', label: 'Compare'  },
            { href: '/history', label: 'History'  },
          ].map(({ href, label }) => (
            <Link key={href} to={href} className="text-xs text-ps-muted transition-colors hover:text-ps-heading">
              {label}
            </Link>
          ))}
          <a href="https://github.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-ps-muted hover:text-ps-heading transition-colors">
            GitHub <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        <p className="text-xs text-ps-faint font-mono">© 2026 PerfScope · MIT License</p>
      </div>
    </footer>
  );
}
