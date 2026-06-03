import { HeroSection }        from '@/widgets/hero';
import { WhySection }         from './WhySection';
import { HowItWorksSection }  from './HowItWorksSection';
import { FeaturesSection }    from './FeaturesSection';
import { ResultsSection }     from './ResultsSection';
import { ScheduledSection }   from './ScheduledSection';
import { ExtensionSection }   from './ExtensionSection';
import { FAQSection }         from './FAQSection';
import { OpenSourceSection }  from './OpenSourceSection';
import { SubscribeSection }   from './SubscribeSection';
import { FooterSection }      from './FooterSection';
import { useScrollReveal }    from '../lib/useScrollReveal';
import { Navbar } from '@/widgets/navbar';

export function LandingPage() {
  useScrollReveal('.landing-page');

  return (
    <div
      className="landing-page"
      id="top"
      style={{ fontFamily: "'Geist', system-ui, sans-serif", background: 'var(--ld-bg)', color: 'var(--ld-text)', lineHeight: 1.5, overflowX: 'hidden' }}
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
