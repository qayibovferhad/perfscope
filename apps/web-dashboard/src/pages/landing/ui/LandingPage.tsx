import { HeroSection }        from './HeroSection';
import { WhySection }         from './WhySection';
import { HowItWorksSection }  from './HowItWorksSection';
import { FeaturesSection }    from './FeaturesSection';
import { MeasurementSection } from './MeasurementSection';
import { ScheduledSection }   from './ScheduledSection';
import { ExtensionSection }   from './ExtensionSection';
import { FAQSection }         from './FAQSection';
import { OpenSourceSection }  from './OpenSourceSection';
import { FooterSection }      from '@/widgets/footer';
import { useScrollReveal }    from '../lib/useScrollReveal';
import { Navbar } from './NavBar';

/**
 * The signed-out entry. Every section states something the signed-in app can show: the
 * newsletter form (no endpoint behind it) and the invented before-and-after are gone.
 */
export function LandingPage() {
  useScrollReveal('.landing-page');

  return (
    <div className="landing-page" id="top">
      <Navbar />
      <HeroSection />
      <WhySection />
      <HowItWorksSection />
      <FeaturesSection />
      <MeasurementSection />
      <ScheduledSection />
      <ExtensionSection />
      <FAQSection />
      <OpenSourceSection />
      <FooterSection />
    </div>
  );
}
