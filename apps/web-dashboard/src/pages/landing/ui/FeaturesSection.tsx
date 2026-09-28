import { useEffect, useRef, type CSSProperties } from 'react';
import {
  Gauge, Crosshair, History, ShieldAlert, CalendarClock, Footprints,
  Radio, GitPullRequest, GitCompareArrows,
} from 'lucide-react';

/**
 * What the product does, in the words the product uses for it.
 *
 * Every line here names something a signed-in user can open. The previous list was the
 * generic feature grid every performance tool ships ("market-share analysis", "heatmap
 * overlays", "unlimited storage") — none of which exist, and a visitor who signed up for
 * one of them would have been right to leave.
 */
const FEATURES = [
  {
    icon: <Gauge className="w-5 h-5" />, tag: 'Audit',
    title: 'Lighthouse, streamed',
    description: 'Performance, accessibility, SEO and best practices for any URL, in a real Chrome. Scores arrive as each category finishes, not when the whole run is over.',
    bullets: ['Mobile or desktop emulation', 'Fast mode, or Precise: three runs, the median reported', 'Pages behind a login, with a session you capture once', 'A read-only share link and a README badge per report'],
  },
  {
    icon: <Crosshair className="w-5 h-5" />, tag: 'Evidence',
    title: 'The element, not the number',
    description: 'Every failing audit comes with what it was looking at: a crop of the element, the request in the waterfall, the frame the shift happened in.',
    bullets: ['Element screenshots for failing checks', 'Request waterfall, filmstrip and main-thread flame chart', 'Layout shifts frame by frame, with the culprit outlined', 'JavaScript treemap by bundle, and AI advice when a Gemini key is set'],
  },
  {
    icon: <History className="w-5 h-5" />, tag: 'History',
    title: 'What moved since last time',
    description: 'Every run is kept. Open one and the previous run of the same URL is compared beside it — same device, same page, so the delta means something.',
    bullets: ['Delta against the previous run, per metric and per audit', 'A ten-point noise floor: small moves are not called regressions', 'Trend per route, grouped by site', 'Deploy markers on the chart, from the CLI or the API'],
  },
  {
    icon: <ShieldAlert className="w-5 h-5" />, tag: 'Budgets',
    title: 'Budgets that page you',
    description: 'A minimum score and ceilings for LCP, TBT and CLS per site. Every stored audit is checked; a breach goes out the moment it is recorded.',
    bullets: ['Slack, Discord or any webhook — the payload matches the target', 'Email when SMTP is configured', 'A later clean audit clears the breach on its own', 'Failed runs never count as a breach'],
  },
  {
    icon: <CalendarClock className="w-5 h-5" />, tag: 'Schedule',
    title: 'Audits while you sleep',
    description: 'Pick the routes and a time. One run a day, several fixed slots, or spread across a window so a site with thirty pages is not audited all at once.',
    bullets: ['Scheduled runs use three-run medians', 'Route discovery from the sitemap', 'Every result lands in history like a manual run', 'A weekly digest of every site, by email'],
  },
  {
    icon: <Footprints className="w-5 h-5" />, tag: 'Flows',
    title: 'Measure after the load',
    description: 'A cold load cannot see the click that freezes or the modal that shifts. A flow scripts the interactions and measures each one in its own window.',
    bullets: ['INP per interaction, not one number for the whole journey', 'TBT and CLS for every step', 'Runs once a day on a schedule, with targets per metric', 'Misses alert through the same channels as budgets'],
  },
  {
    icon: <Radio className="w-5 h-5" />, tag: 'Field',
    title: 'Real users, next to the lab',
    description: 'Chrome UX Report p75s for the URL sit beside the lab numbers, and a one-line snippet reports your own visitors when CrUX has nothing for you.',
    bullets: ['CrUX at URL level, falling back to origin', 'RUM snippet served from your own install', 'p75 over real sessions, with a fifty-sample floor', 'Field budgets checked hourly'],
  },
  {
    icon: <GitPullRequest className="w-5 h-5" />, tag: 'CI',
    title: 'A budget on every pull request',
    description: 'The CLI audits a URL and exits non-zero when the budget is missed. The GitHub Action wraps it into one comment that keeps itself current and a check on the commit.',
    bullets: ['perfscope ci --url … --budget "performance=80,lcp=2500"', 'Exit 1 is a slow page; exit 2 is a run that never measured', 'Annotations and a step summary in the job', 'warn-only reports neutral instead of red'],
  },
  {
    icon: <GitCompareArrows className="w-5 h-5" />, tag: 'Compare',
    title: 'Two pages, side by side',
    description: 'Yours against a competitor, or one deploy against the last. Both audits run at once and the filmstrips play together.',
    bullets: ['Any two URLs, same device, same moment', 'Any two stored runs of your own', 'A competitor behind a login, with its own captured session', 'From the extension: the tab you are on, against a site you track'],
  },
] as const;

function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}

export function FeaturesSection() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = gridRef.current?.querySelectorAll<HTMLElement>('[data-feat]');
    if (!cards) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        const delay = reduced ? 0 : Number(el.dataset.col ?? 0) * 60;
        setTimeout(() => { el.dataset.visible = 'true'; }, delay);
        io.unobserve(el);
      });
    }, { threshold: 0.1 });

    cards.forEach(c => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <section id="features" className="border-y border-ld-border bg-ld-bg-2 py-[clamp(72px,11vw,140px)]">
      <div className="ld-wrap">

        <div className="reveal text-center max-w-[720px] mx-auto mb-[clamp(44px,6vw,70px)]">
          <span className="ld-eyebrow block mb-4">Features</span>
          <h2 className="ld-h-section text-ld-text">Everything a slow page can hide.</h2>
          <p className="ld-lead mt-[18px] mx-auto">
            Nine things you can open today. Each one is named the way the app names it.
          </p>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 min-[760px]:grid-cols-2 min-[980px]:grid-cols-3 gap-[18px]">
          {FEATURES.map(({ icon, tag, title, description, bullets }, idx) => (
            <div
              key={title}
              data-feat
              data-col={idx % 3}
              onMouseMove={onMouseMove}
              // The spotlight follows the cursor; a runtime coordinate has no class.
              style={{ '--mx': '50%', '--my': '50%' } as CSSProperties}
              className={[
                'group relative overflow-hidden isolate p-[26px] rounded-2xl cursor-default',
                'border border-ld-border bg-ld-surface',
                'opacity-0 transition-[opacity,transform,border-color,box-shadow] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]',
                'data-[visible=true]:opacity-100',
                'hover:border-ld-accent-line hover:-translate-y-1',
                'hover:shadow-[0_0_0_1px_var(--ld-accent-soft),0_26px_56px_-30px_rgba(var(--ld-accent-rgb),.5)]',
                'before:content-[""] before:absolute before:inset-0 before:-z-10 before:pointer-events-none',
                'before:bg-[radial-gradient(420px_circle_at_var(--mx)_var(--my),var(--ld-accent-soft),transparent_60%)]',
                'before:opacity-0 before:transition-opacity before:duration-300',
                'hover:before:opacity-100',
                'after:content-[""] after:absolute after:inset-x-0 after:top-0 after:h-[2px] after:z-10 after:pointer-events-none',
                'after:bg-ld-grad after:scale-x-0 after:origin-left',
                'after:transition-transform after:duration-[400ms] after:ease-[cubic-bezier(.4,.8,.3,1)]',
                'hover:after:scale-x-100',
                'motion-reduce:opacity-100 motion-reduce:transition-none',
              ].join(' ')}
            >
              <div className="flex items-start justify-between mb-5">
                <div className={[
                  'w-[46px] h-[46px] rounded-[13px] border border-ld-border-strong bg-ld-surface-2',
                  'text-ld-accent grid place-items-center shrink-0',
                  'transition-[background,border-color,box-shadow,transform,color] duration-[350ms] ease-[cubic-bezier(.34,1.56,.5,1)]',
                  'group-hover:bg-ld-grad group-hover:text-ld-grad-text',
                  'group-hover:border-transparent group-hover:shadow-ld-glow group-hover:-translate-y-0.5',
                ].join(' ')}>
                  <span className="transition-transform duration-[350ms] ease-[cubic-bezier(.34,1.56,.5,1)] group-hover:scale-[1.06]">
                    {icon}
                  </span>
                </div>

                <span className={[
                  'font-mono text-[10.5px] tracking-[.06em] px-[10px] py-1 rounded-[7px]',
                  'border border-ld-border text-ld-text-3',
                  'transition-[color,border-color,background] duration-200',
                  'group-hover:text-ld-accent-2 group-hover:border-ld-accent-line group-hover:bg-ld-accent-soft',
                ].join(' ')}>
                  {tag}
                </span>
              </div>

              <h3 className="text-[19px] font-bold text-ld-text mb-[10px]">{title}</h3>
              <p className="text-ld-text-2 text-[14.5px] mb-[18px]">{description}</p>

              <ul className="grid gap-[9px] list-none p-0 m-0">
                {bullets.map(b => (
                  <li key={b} className="flex items-start gap-[9px] text-[13.5px]">
                    <span className="w-[6px] h-[6px] rounded-full mt-[7px] shrink-0 block bg-ld-accent-line transition-[background,box-shadow] duration-200 group-hover:bg-ld-accent group-hover:shadow-[0_0_0_3px_var(--ld-accent-soft)]" />
                    <span className="text-ld-text-2 transition-colors duration-200 group-hover:text-ld-text">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
