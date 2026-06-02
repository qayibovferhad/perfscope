import { motion } from 'framer-motion';
import { Globe, CheckCircle } from 'lucide-react';

const scaleIn = {
  hidden:  { opacity: 0, scale: 0.93 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const SPARK_DATA = [38, 47, 55, 63, 71, 79, 87, 94];
const SW = 240, SH = 50;

const GOOD = 'var(--ps-healthy)';
const WARN = 'var(--ps-amber)';

const METRICS = [
  { label: 'LCP', value: '1.2s',  color: GOOD, status: 'Good'       },
  { label: 'CLS', value: '0.08',  color: GOOD, status: 'Good'       },
  { label: 'TBT', value: '140ms', color: WARN, status: 'Needs Work' },
  { label: 'FCP', value: '0.9s',  color: GOOD, status: 'Good'       },
];

export function PerformanceDashboard() {
  const score  = 94;
  const radius = 42;
  const circ   = 2 * Math.PI * radius;
  const filled = (score / 100) * circ;

  const sparkPts = SPARK_DATA.map((v, i) => {
    const x = (i / (SPARK_DATA.length - 1)) * SW;
    const y = SH - (v / 100) * SH;
    return `${x},${y}`;
  }).join(' ');

  return (
    <motion.div
      variants={scaleIn}
      className="ps-panel rounded-[1.25rem] border-ps-accent-border max-w-[500px] w-full shadow-[0_0_100px_rgba(139,92,246,0.13),0_32px_64px_rgba(0,0,0,0.55)]"
    >
      {/* Window chrome */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-ps-regression/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-ps-amber/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-ps-healthy/70" />
          <span className="ml-2 text-xs text-ps-muted font-mono">perfscope — audit</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold ps-badge-ok">● DONE</span>
      </div>

      <div className="p-5 space-y-4">
        {/* URL bar */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg ps-subtle">
          <Globe className="w-3 h-3 shrink-0 text-ps-muted" />
          <span className="text-[11px] flex-1 text-ps-secondary font-mono">https://example.com</span>
          <span className="text-[9px] font-mono font-semibold text-ps-healthy">1.8s</span>
        </div>

        {/* Score gauge + metrics */}
        <div className="flex items-center gap-5">
          <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r={radius} fill="none" className="stroke-white/[0.06]" strokeWidth="6" />
              <motion.circle cx="50" cy="50" r={radius} fill="none" stroke="#10b981" strokeWidth="6"
                strokeLinecap="round" strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: circ - filled }}
                transition={{ duration: 1.6, ease: 'easeOut', delay: 0.4 }}
                style={{ filter: 'drop-shadow(0 0 8px #10b981)' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold leading-none text-ps-healthy font-mono">{score}</span>
              <span className="text-[9px] mt-0.5 text-ps-muted">/ 100</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 flex-1">
            {METRICS.map(({ label, value, color, status }) => {
              const isGood = color === GOOD;
              return (
                <div key={label}
                  className={`flex flex-col gap-0.5 px-2.5 py-2 rounded-lg border ${
                    isGood
                      ? 'bg-ps-healthy-muted border-ps-healthy-border'
                      : 'bg-ps-amber-muted border-ps-amber-border'
                  }`}>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-ps-muted">{label}</span>
                  <span className={`text-sm font-extrabold font-mono ${isGood ? 'text-ps-healthy' : 'text-ps-amber'}`}>{value}</span>
                  <span className={`text-[8px] opacity-75 ${isGood ? 'text-ps-healthy' : 'text-ps-amber'}`}>{status}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sparkline */}
        <div className="ps-glass p-3 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-ps-muted">Score History</p>
          <svg viewBox={`0 0 ${SW} ${SH}`} className="w-full" style={{ height: 48, overflow: 'visible' }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#8b5cf6" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`0,${SH} ${sparkPts} ${SW},${SH}`} fill="url(#sparkFill)" />
            <polyline points={sparkPts} fill="none" stroke="#8b5cf6" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 5px rgba(139,92,246,0.7))' }} />
            <circle cx={SW} cy={SH - (94 / 100) * SH} r="3.5" fill="#8b5cf6"
              style={{ filter: 'drop-shadow(0 0 5px #8b5cf6)' }} />
          </svg>
          <div className="flex justify-between">
            {SPARK_DATA.map((v, i) => (
              <span key={i} className={`text-[8px] font-mono ${i === SPARK_DATA.length - 1 ? 'text-ps-accent' : 'text-ps-faint'}`}>
                {v}
              </span>
            ))}
          </div>
        </div>

        {/* Pass badge */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg ps-badge-ok">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[11px] font-semibold">All Core Web Vitals passing</span>
        </div>
      </div>
    </motion.div>
  );
}
