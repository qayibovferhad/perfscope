import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnalysisProgress } from '../types';

const STAGES = [
  { label: 'Launching',  threshold: 10  },
  { label: 'Navigating', threshold: 25  },
  { label: 'Auditing',   threshold: 45  },
  { label: 'Processing', threshold: 80  },
  { label: 'Done',       threshold: 100 },
] as const;

interface Props { progress: AnalysisProgress }

export function ProgressStepper({ progress }: Props) {
  const pct = progress.progress;

  // Current active step = last stage whose threshold has been reached
  const current = STAGES.reduce((acc, s, i) => (s.threshold <= pct ? i : acc), 0);

  return (
    <div className="space-y-4">
      {/* Bar */}
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Steps */}
      <div className="flex justify-between">
        {STAGES.map((stage, i) => {
          const done   = i < current;
          const active = i === current;
          return (
            <div key={stage.label} className="flex flex-col items-center gap-1.5 flex-1">
              <div className={cn(
                'w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors duration-300',
                done   && 'border-primary bg-primary text-primary-foreground',
                active && 'border-primary bg-background',
                !done && !active && 'border-muted bg-muted/30',
              )}>
                <AnimatePresence mode="wait">
                  {done ? (
                    <motion.div key="check"
                      initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                      transition={{ duration: 0.2 }}>
                      <Check className="w-3.5 h-3.5" />
                    </motion.div>
                  ) : active ? (
                    <motion.div key="spin"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                    </motion.div>
                  ) : (
                    <motion.span key="dot" className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                  )}
                </AnimatePresence>
              </div>
              <span className={cn(
                'text-[10px] text-center leading-tight hidden sm:block transition-colors',
                active ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Live message */}
      <AnimatePresence mode="wait">
        <motion.p key={progress.message}
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}
          className="text-xs text-center text-muted-foreground"
        >
          {progress.message}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
