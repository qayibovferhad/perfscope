const NAV_COLS = [
  {
    heading: 'Product',
    links: [
      { l: 'Features',     h: '#features' },
      { l: 'How it works', h: '#how'      },
      { l: 'Results',      h: '#proof'    },
      { l: 'FAQ',          h: '#faq'      },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { l: 'Docs',                   h: '#' },
      { l: 'Core Web Vitals guide',  h: '#' },
      { l: 'Changelog',              h: '#' },
      { l: 'Status',                 h: '#' },
    ],
  },
  {
    heading: 'Project',
    links: [
      { l: 'GitHub',        h: '#' },
      { l: 'License (MIT)', h: '#' },
      { l: 'Contribute',    h: '#' },
      { l: 'Contact',       h: '#' },
    ],
  },
] as const;

const SOCIAL_LINKS = [
  {
    label: 'GitHub',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <path d="M9 19c-4.5 1.3-4.5-2.2-6-2.6M16 22v-3.6c0-1 .3-1.4 1-2 -3.4-.4-7-1.7-7-7.6 0-1.6.5-2.9 1.4-3.9 -.4-1-.4-2.4.1-3.5 0 0 1.2-.4 3.9 1.4 1.1-.3 2.3-.5 3.5-.5s2.4.2 3.5.5c2.7-1.8 3.9-1.4 3.9-1.4.5 1.1.5 2.5.1 3.5.9 1 1.4 2.3 1.4 3.9 0 5.9-3.6 7.2-7 7.6.5.6 1 1.5 1 3v3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: 'X',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <path d="M4 4l16 16M20 4L4 20" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
      </svg>
    ),
  },
] as const;

export function FooterSection() {
  return (
    <footer className="border-t border-[var(--ld-border)] pt-14 pb-10">
      <div className="ld-wrap">

        {/* Top grid */}
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 min-[980px]:grid-cols-[1.4fr_1fr_1fr_1fr] gap-8 mb-11">

          {/* Brand */}
          <div>
            <a
              href="#top"
              className="inline-flex items-center gap-[10px] font-bold text-[17px] tracking-[-0.02em] text-[var(--ld-text)] no-underline"
            >
              <span
                className="w-[30px] h-[30px] rounded-[9px] grid place-items-center shrink-0"
                style={{ background: 'var(--ld-grad)', boxShadow: 'var(--ld-glow)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-[17px] h-[17px]">
                  <path d="M3 12h3l2.5-7 4 14 3-9 2 2H21" stroke="#04130d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              Perf<b className="text-[var(--ld-accent-2)] font-extrabold">Scope</b>
            </a>
            <p className="text-[var(--ld-text-2)] text-[14px] mt-[14px] max-w-[30ch]">
              An open-source tool that makes Lighthouse audits visible, trackable and fixable.
            </p>
          </div>

          {/* Nav columns */}
          {NAV_COLS.map(({ heading, links }) => (
            <div key={heading}>
              {/* h3, not h4: these are the first subdivision after the page's h2 sections,
                  and the jump was breaking heading order for anyone navigating by headings. */}
              <h3 className="font-mono text-[13px] uppercase tracking-[.1em] text-[var(--ld-text-3)] mb-4 font-semibold">
                {heading}
              </h3>
              {links.map(({ l, h }) => (
                <a
                  key={l}
                  href={h}
                  className="block text-[var(--ld-text-2)] text-[14px] py-[5px] no-underline transition-colors duration-200 hover:text-[var(--ld-accent)]"
                >
                  {l}
                </a>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-[26px] border-t border-[var(--ld-border)]">
          <span className="font-mono text-[12.5px] text-[var(--ld-text-3)]">© 2026 PerfScope · MIT License</span>
          <div className="flex gap-2">
            {SOCIAL_LINKS.map(({ label, icon }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="w-9 h-9 rounded-[9px] grid place-items-center border border-[var(--ld-border)] text-[var(--ld-text-2)] no-underline transition-[color,border-color] duration-200 hover:text-[var(--ld-accent)] hover:border-[var(--ld-accent-line)]"
              >
                {icon}
              </a>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
}
