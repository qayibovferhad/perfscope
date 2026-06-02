import { motion } from 'framer-motion';
import { scoreColor } from '@/entities/analysis';

interface Props {
  score: number;
  label: string;
}

export function ScoreGauge({ score, label }: Props) {
  const color = scoreColor(score);
  const circ  = 2 * Math.PI * 28;
  const dash  = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r="28" fill="none" className="stroke-white/[0.06]" strokeWidth="5" />
          <motion.circle
            cx="32" cy="32" r="28"
            fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            whileInView={{ strokeDashoffset: circ - dash }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-extrabold font-mono" style={{ color }}>{score}</span>
        </div>
      </div>
      <p className="text-xs font-medium text-ps-muted">{label}</p>
    </div>
  );
}
