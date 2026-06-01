import { NavBar }            from './ui/NavBar';
import { HeroSection }       from './ui/HeroSection';
import { FeaturesSection }   from './ui/FeaturesSection';
import { BenchmarksSection } from './ui/BenchmarksSection';
import { FinalCTASection }   from './ui/FinalCTASection';
import { Footer }            from './ui/Footer';

function SectionDivider() {
  return (
    <div className="max-w-6xl mx-auto px-6">
      <div style={{ height: '1px', background: 'var(--ps-divider)' }} />
    </div>
  );
}

export function LandingPage() {
  return (
    <div style={{ background: 'var(--ps-page-bg)', minHeight: '100vh' }}>
      <div className="flex flex-col min-h-screen">
        <NavBar />
        <HeroSection />
      </div>
      <SectionDivider />
      <FeaturesSection />
      <SectionDivider />
      <BenchmarksSection />
      <FinalCTASection />
      <Footer />
    </div>
  );
}
