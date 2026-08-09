import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ open, onClose, children }: ModalProps) {
  const { theme } = useTheme();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const scrimBg = theme === 'light' ? 'rgba(10,40,28,0.34)' : 'rgba(2,8,5,0.62)';

  // Rendered into <body>, never in place. A modal mounted inside the tree inherits
  // whatever its surroundings impose: the sidebar is position:sticky and therefore its
  // own stacking context, so the scrim's z-[200] only applied within the sidebar column
  // and left the page beside it undimmed — reading as if the content lit up. Layout
  // containers cause the same class of bug (a space-y parent shifting siblings, a card
  // repainting --ld-accent). A portal removes all of it at once.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] grid place-items-center p-6 backdrop-blur-[6px]"
          style={{ background: scrimBg }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: 14, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, scale: 0.99, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="w-[min(480px,100%)] bg-ld-surface border border-ld-border-strong rounded-[20px] p-[26px] relative overflow-hidden"
            style={{ boxShadow: '0 40px 100px -30px rgba(0,0,0,.7), 0 0 0 1px var(--ld-accent-soft)' }}
          >
            {/* Top-left emerald radial glow */}
            <div
              className="absolute inset-0 rounded-[20px] pointer-events-none"
              style={{ background: 'radial-gradient(420px 200px at 0% 0%, var(--ld-accent-soft), transparent 60%)' }}
            />

            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 w-8 h-8 rounded-[9px] grid place-items-center text-ld-text-3 border border-transparent bg-transparent cursor-pointer transition-all duration-200 hover:text-ld-text hover:bg-ld-surface-hover hover:border-ld-border z-10"
            >
              <X className="w-[17px] h-[17px]" />
            </button>

            <div className="relative z-[1]">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
