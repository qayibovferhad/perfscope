import { motion } from 'framer-motion';
import { Globe, GitCompareArrows, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';

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
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 rounded-2xl bg-ld-surface-2 border border-ld-border-strong [box-shadow:var(--ld-shadow-card)]"
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                selectedCount > i ? 'bg-ld-accent' : 'bg-ld-surface border border-ld-border-strong'
              }`}
            >
              {selectedCount > i && <span className="text-white text-[10px] font-bold">✓</span>}
            </div>
          ))}
        </div>
        <span className="text-xs font-semibold text-ld-text-2">
          {selectedCount}/2 selected
        </span>
      </div>

      <div className="w-px h-4 bg-ld-border" />

      {selectedCount === 1 && (
        <Button variant="outline" size="sm" onClick={onCrossSite}>
          <Globe className="w-3.5 h-3.5" />
          Compare with another website
        </Button>
      )}

      {selectedCount < 2 && (
        <span className="text-xs text-ld-text-3">
          {selectedCount === 0 ? 'Select 2 audits' : 'Select 1 more'}
        </span>
      )}

      {selectedCount === 2 && (
        <Button variant="accent-flat" size="sm" onClick={onCompare}>
          <GitCompareArrows className="w-3.5 h-3.5" />
          Compare
        </Button>
      )}

      <Button variant="ghost" size="icon-sm" onClick={onExit} aria-label="Exit compare mode">
        <X />
      </Button>
    </motion.div>
  );
}
