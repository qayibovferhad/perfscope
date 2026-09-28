import { Link } from 'react-router-dom';
import { GITHUB_URL, DOCS_URL, LICENSE_URL, ACTION_URL, CLI_URL } from '@/shared/config/links';

/**
 * Every link here goes somewhere. The columns used to list Docs, Changelog, Status and
 * Contact as `#` — a footer of dead links tells a visitor exactly how finished the
 * product is, and it was wrong about that.
 */
const NAV_COLS = [
  {
    heading: 'Product',
    links: [
      { l: 'How it works', h: '#how',      external: false },
      { l: 'Features',     h: '#features', external: false },
      { l: 'Measurement',  h: '#measure',  external: false },
      { l: 'FAQ',          h: '#faq',      external: false },
    ],
  },
  {
    heading: 'Use it',
    links: [
      { l: 'Sign in',         h: '/login',    external: false },
      { l: 'Create account',  h: '/register', external: false },
      { l: 'CLI',             h: CLI_URL,     external: true  },
      { l: 'GitHub Action',   h: ACTION_URL,  external: true  },
    ],
  },
  {
    heading: 'Project',
    links: [
      { l: 'Source on GitHub', h: GITHUB_URL,  external: true },
      { l: 'Deployment guide', h: DOCS_URL,    external: true },
      { l: 'License (MIT)',    h: LICENSE_URL, external: true },
      { l: 'Core Web Vitals',  h: 'https://web.dev/articles/vitals', external: true },
    ],
  },
] as const;

const LINK_CLASS = 'block text-ld-text-2 text-[14px] py-[5px] no-underline transition-colors duration-200 hover:text-ld-accent';

export function FooterSection() {
  return (
    <footer className="border-t border-ld-border pt-14 pb-10">
      <div className="ld-wrap">
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 min-[980px]:grid-cols-[1.4fr_1fr_1fr_1fr] gap-8 mb-11">

          <div>
            <a href="#top" className="inline-flex items-center gap-[10px] font-bold text-[17px] tracking-[-0.02em] text-ld-text no-underline">
              <span className="w-[30px] h-[30px] rounded-[9px] grid place-items-center shrink-0 bg-ld-grad shadow-ld-glow">
                <svg viewBox="0 0 24 24" fill="none" className="w-[17px] h-[17px]" aria-hidden>
                  <path d="M3 12h3l2.5-7 4 14 3-9 2 2H21" stroke="#04130d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              Perf<b className="text-ld-accent-2 font-extrabold">Scope</b>
            </a>
            <p className="text-ld-text-2 text-[14px] mt-[14px] max-w-[30ch]">
              Lighthouse audits you can keep, compare, budget and put in a pull request.
            </p>
          </div>

          {NAV_COLS.map(({ heading, links }) => (
            <div key={heading}>
              {/* h3, not h4: these are the first subdivision after the page's h2 sections,
                  and the jump was breaking heading order for anyone navigating by headings. */}
              <h3 className="font-mono text-[13px] uppercase tracking-[.1em] text-ld-text-3 mb-4 font-semibold">
                {heading}
              </h3>
              {links.map(({ l, h, external }) => (
                external
                  ? <a key={l} href={h} target="_blank" rel="noreferrer" className={LINK_CLASS}>{l}</a>
                  : h.startsWith('#')
                    ? <a key={l} href={h} className={LINK_CLASS}>{l}</a>
                    : <Link key={l} to={h} className={LINK_CLASS}>{l}</Link>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 pt-[26px] border-t border-ld-border">
          <span className="font-mono text-[12.5px] text-ld-text-3">© 2026 PerfScope · MIT License</span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="PerfScope on GitHub"
            className="w-9 h-9 rounded-[9px] grid place-items-center border border-ld-border text-ld-text-2 no-underline transition-[color,border-color] duration-200 hover:text-ld-accent hover:border-ld-accent-line"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden>
              <path d="M9 19c-4.5 1.3-4.5-2.2-6-2.6M16 22v-3.6c0-1 .3-1.4 1-2 -3.4-.4-7-1.7-7-7.6 0-1.6.5-2.9 1.4-3.9 -.4-1-.4-2.4.1-3.5 0 0 1.2-.4 3.9 1.4 1.1-.3 2.3-.5 3.5-.5s2.4.2 3.5.5c2.7-1.8 3.9-1.4 3.9-1.4.5 1.1.5 2.5.1 3.5.9 1 1.4 2.3 1.4 3.9 0 5.9-3.6 7.2-7 7.6.5.6 1 1.5 1 3v3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
