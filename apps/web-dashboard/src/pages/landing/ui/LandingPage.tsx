import { Navbar }           from '@/widgets/navbar';
import { HeroSection }      from '@/widgets/hero';
import { FeaturesSection }  from '@/widgets/features';
import { BenchmarksSection } from '@/widgets/benchmarks';
import { FinalCTASection }  from '@/widgets/final-cta';
import { Footer }           from '@/widgets/footer';
import { SectionDivider }   from '@/shared/ui/section-divider';

export function LandingPage() {
  return (
    <div className="bg-ps-page min-h-screen">
      <div className="flex flex-col min-h-screen">
        <Navbar />
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
