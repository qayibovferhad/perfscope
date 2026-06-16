import { motion } from 'framer-motion';
import { Globe, GitCompareArrows, X } from 'lucide-react';

export function CompareBar({
  selectedCount,
  onCrossSite,
  onCompare,
  onExit,
}: {
  selectedCount: number;
  onCrossSite: () => void;
  onCompare: () => void;
  onExit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
      style={{
        background: '#111827',
        border: '1px solid rgba(99,102,241,0.35)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.2)',
      }}
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="w-5 h-5 rounded flex items-center justify-center transition-all"
              style={{
                background: selectedCount > i ? 'var(--ps-accent)' : 'rgba(255,255,255,0.08)',
                border: selectedCount > i ? 'none' : '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {selectedCount > i && <span className="text-white text-[10px] font-bold">✓</span>}
            </div>
          ))}
        </div>
        <span className="text-xs font-semibold" style={{ color: 'var(--ps-text-secondary)' }}>
          {selectedCount}/2 selected
        </span>
      </div>

      <div className="w-px h-4" style={{ background: 'var(--ps-divider)' }} />

      {selectedCount === 1 && (
        <button
          onClick={onCrossSite}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--ps-text-secondary)',
            border: '1px solid var(--ps-panel-border)',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)')}
        >
          <Globe className="w-3.5 h-3.5" />
          Compare with another website
        </button>
      )}

      {selectedCount < 2 && (
        <span className="text-xs" style={{ color: 'var(--ps-text-muted)' }}>
          {selectedCount === 0 ? 'Select 2 audits' : 'Select 1 more'}
        </span>
      )}

      {selectedCount === 2 && (
        <button
          onClick={onCompare}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'var(--ps-accent)', color: '#fff' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.9')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
        >
          <GitCompareArrows className="w-3.5 h-3.5" />
          Compare
        </button>
      )}

      <button
        onClick={onExit}
        className="p-1.5 rounded-lg transition-colors"
        style={{ color: 'var(--ps-text-muted)' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-heading)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--ps-text-muted)')}
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
