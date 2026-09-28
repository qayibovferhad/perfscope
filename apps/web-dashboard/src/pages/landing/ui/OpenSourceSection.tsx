import { Button } from '@/shared/ui/button';
import { GITHUB_URL, DOCS_URL } from '@/shared/config/links';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M9 19c-4.5 1.3-4.5-2.2-6-2.6M16 22v-3.6c0-1 .3-1.4 1-2-3.4-.4-7-1.7-7-7.6 0-1.6.5-2.9 1.4-3.9-.4-1-.4-2.4.1-3.5 0 0 1.2-.4 3.9 1.4 1.1-.3 2.3-.5 3.5-.5s2.4.2 3.5.5c2.7-1.8 3.9-1.4 3.9-1.4.5 1.1.5 2.5.1 3.5.9 1 1.4 2.3 1.4 3.9 0 5.9-3.6 7.2-7 7.6.5.6 1 1.5 1 3v3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/**
 * The terminal shows the two commands a host actually runs. Star and fork counts were
 * here once, invented; a number nobody measured has no place on this page of all pages.
 */
const LINES = [
  { kind: 'cmd',  text: 'docker compose --env-file .env.docker \\' },
  { kind: 'cont', text: '-f docker-compose.deploy.yml up -d' },
  { kind: 'out',  text: '✔ perfscope-backend  healthy · chromium bundled' },
  { kind: 'out',  text: '✔ perfscope-web      :8080   · /api proxied' },
  { kind: 'cmd',  text: 'perfscope ci --url https://example.com \\' },
  { kind: 'cont', text: '--budget "performance=80,lcp=2500"' },
  { kind: 'out',  text: 'performance 94 ≥ 80 · lcp 1.2s ≤ 2.5s · exit 0' },
] as const;

const FACTS = ['MIT license', 'Node 22 · pnpm', 'Images on GHCR', 'linux/amd64'] as const;

export function OpenSourceSection() {
  return (
    <section className="py-[clamp(72px,11vw,140px)] border-t border-ld-border bg-ld-bg-2">
      <div className="ld-wrap">
        <div className="reveal grid grid-cols-1 min-[760px]:grid-cols-[1fr_1.1fr] gap-[clamp(32px,5vw,64px)] items-center rounded-[22px] border border-ld-border-strong p-[clamp(36px,5vw,60px)] bg-[radial-gradient(620px_280px_at_12%_0%,var(--ld-accent-soft),transparent_65%),var(--ld-surface)]">
          <div>
            <span className="ld-eyebrow block mb-4">Open source</span>
            <h2 className="text-[clamp(28px,3.8vw,46px)] font-black tracking-[-0.03em] leading-[1.04] text-ld-text m-0">
              Run it yourself,<br />or help build it.
            </h2>
            <p className="text-ld-text-2 text-[16px] mt-[18px] max-w-[42ch]">
              Every line is public. Deploy the two images on any host with Docker, read how a
              number was made, or send a pull request. Your audits stay on your server.
            </p>
            <div className="flex gap-3 mt-7 flex-wrap">
              <Button asChild size="lg">
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                  <GithubIcon className="w-4 h-4" />
                  View on GitHub
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={DOCS_URL} target="_blank" rel="noreferrer">Deployment guide</a>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-ld-border-strong bg-ld-bg overflow-hidden shadow-ld-shadow-card">
            <div className="flex items-center gap-3 px-[14px] py-[11px] border-b border-ld-border bg-ld-surface-2">
              <span className="flex gap-[6px]" aria-hidden>
                {[0, 1, 2].map(i => <i key={i} className="w-[10px] h-[10px] rounded-full bg-ld-border-strong block not-italic" />)}
              </span>
              <span className="font-mono text-[12px] text-ld-text-3">~/perfscope</span>
            </div>

            <div className="p-[18px] grid gap-[7px] font-mono text-[12.5px] leading-[1.55] overflow-x-auto">
              {LINES.map(({ kind, text }) => (
                <p key={text} className={`m-0 whitespace-nowrap ${kind === 'out' ? 'text-ld-text-2' : 'text-ld-text'} ${kind === 'cont' ? 'pl-[22px]' : ''}`}>
                  {kind === 'cmd' && <span className="text-ld-accent mr-2">$</span>}
                  {text}
                </p>
              ))}
            </div>

            <div className="flex gap-4 flex-wrap px-[18px] py-[12px] border-t border-ld-border bg-ld-surface-2">
              {FACTS.map(f => (
                <span key={f} className="font-mono text-[12px] text-ld-text-2">{f}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
