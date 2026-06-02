import { motion } from 'framer-motion';
import type { FeatureCardData } from '../model/featuresData';

const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};

export function FeatureCard({ icon, accentColor, glowColor, title, description, bullets, tag }: FeatureCardData) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="ps-panel rounded-[1.25rem] h-full transition-shadow duration-300"
      style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 0 28px ${glowColor}` }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 1px ${accentColor}40, 0 0 48px ${glowColor}, 0 16px 40px rgba(0,0,0,0.4)`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 1px rgba(255,255,255,0.05), 0 0 28px ${glowColor}`; }}
    >
      <div className="p-7 space-y-5 h-full">
        <div className="flex items-start justify-between">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}>
            <div style={{ color: accentColor }}>{icon}</div>
          </div>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}28`, color: accentColor }}>
            {tag}
          </span>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-ps-heading">{title}</h3>
          <p className="text-sm leading-relaxed text-ps-secondary">{description}</p>
        </div>
        <ul className="space-y-2">
          {bullets.map(b => (
            <li key={b} className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full shrink-0" style={{ background: accentColor, boxShadow: `0 0 4px ${accentColor}` }} />
              <span className="text-xs text-ps-muted">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
