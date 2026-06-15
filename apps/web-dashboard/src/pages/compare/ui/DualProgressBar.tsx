import { motion } from 'framer-motion';

export function DualProgressBar({
  targetPct, competitorPct, targetDone, competitorDone,
}: {
  targetPct: number; competitorPct: number;
  targetDone: boolean; competitorDone: boolean;
}) {
  const tPct = targetDone     ? 100 : targetPct;
  const cPct = competitorDone ? 100 : competitorPct;

  return (
    <div className="px-8 pb-4 space-y-1.5">
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-indigo-500"
          animate={{ width: `${tPct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-orange-500"
          animate={{ width: `${cPct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
