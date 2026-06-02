import { motion } from 'framer-motion';
import { FEATURES } from '../model/featuresData';
import { FeatureCard } from './FeatureCard';

const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = (delay = 0.11) => ({
  hidden:  {},
  visible: { transition: { staggerChildren: delay } },
});

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-4">
      <div className="max-w-[1400px] mx-auto space-y-14">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: '-80px' }} className="text-center space-y-4">
          <motion.p variants={fadeUp} className="ps-section-label">Features</motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl font-extrabold tracking-tight text-ps-heading">
            Everything you need to ship fast, stable pages.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-base max-w-xl mx-auto text-ps-secondary">
            From raw Lighthouse scores to frame-level CLS inspection, network waterfalls,
            and instant AI fixes — one tool, complete visibility.
          </motion.p>
        </motion.div>

        <motion.div variants={stagger(0.1)} initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
        </motion.div>
      </div>
    </section>
  );
}
