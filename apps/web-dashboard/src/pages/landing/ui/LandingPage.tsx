import { HeroSection }        from './HeroSection';
import { WhySection }         from './WhySection';
import { HowItWorksSection }  from './HowItWorksSection';
import { FeaturesSection }    from './FeaturesSection';
import { ResultsSection }     from './ResultsSection';
import { ScheduledSection }   from './ScheduledSection';
import { ExtensionSection }   from './ExtensionSection';
import { FAQSection }         from './FAQSection';
import { OpenSourceSection }  from './OpenSourceSection';
import { SubscribeSection }   from '@/features/subscribe';
import { FooterSection }      from '@/widgets/footer';
import { useScrollReveal }    from '../lib/useScrollReveal';
import { Navbar } from './NavBar';

export function LandingPage() {
  useScrollReveal('.landing-page');

  return (
    <div
      className="landing-page"
      id="top"
    >
      <Navbar />
      <HeroSection />
      <WhySection />
      <HowItWorksSection />
      <FeaturesSection />
      <ResultsSection />
      <ScheduledSection />
      <ExtensionSection />
      <FAQSection />
      <OpenSourceSection />
      <SubscribeSection />
      <FooterSection />
    </div>
  );
}
