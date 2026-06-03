import { Button } from '@/shared/ui/button';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9 19c-4.5 1.3-4.5-2.2-6-2.6M16 22v-3.6c0-1 .3-1.4 1-2-3.4-.4-7-1.7-7-7.6 0-1.6.5-2.9 1.4-3.9-.4-1-.4-2.4.1-3.5 0 0 1.2-.4 3.9 1.4 1.1-.3 2.3-.5 3.5-.5s2.4.2 3.5.5c2.7-1.8 3.9-1.4 3.9-1.4.5 1.1.5 2.5.1 3.5.9 1 1.4 2.3 1.4 3.9 0 5.9-3.6 7.2-7 7.6.5.6 1 1.5 1 3v3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const REPO_STATS = [
  {
    val: '4.2k', label: 'stars',
    icon: <svg viewBox="0 0 24 24" fill="none" className="w-[15px] h-[15px] text-[var(--ld-accent)]"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.9 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  },
  {
    val: '380', label: 'forks',
    icon: <svg viewBox="0 0 24 24" fill="none" className="w-[15px] h-[15px] text-[var(--ld-accent)]"><circle cx="6" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.6"/><circle cx="6" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.6"/><circle cx="18" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.6"/><path d="M6 8.4v7.2M8.2 7.2C12 7.2 18 7 18 10.4" stroke="currentColor" strokeWidth="1.6"/></svg>,
  },
  {
    val: 'MIT', label: 'license',
    icon: <svg viewBox="0 0 24 24" fill="none" className="w-[15px] h-[15px] text-[var(--ld-accent)]"><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/></svg>,
  },
] as const;

export function OpenSourceSection() {
  return (
    <section className="pt-[clamp(72px,11vw,140px)]">
      <div className="ld-wrap">
        <div
          className="reveal grid grid-cols-1 min-[760px]:grid-cols-[1fr_1.1fr] gap-[clamp(32px,5vw,64px)] items-center rounded-[22px] border border-[var(--ld-border-strong)] p-[clamp(36px,5vw,60px)]"
          style={{ background: 'radial-gradient(620px 280px at 12% 0%, var(--ld-accent-soft), transparent 65%), var(--ld-surface)' }}
        >
          {/* Left */}
          <div>
            <span className="ld-eyebrow block mb-4">Open source</span>
            <h2 className="text-[clamp(28px,3.8vw,46px)] font-black tracking-[-0.03em] leading-[1.04] text-[var(--ld-text)] m-0">
              Run it yourself,<br />or help build it.
            </h2>
            <p className="text-[var(--ld-text-2)] text-[16px] mt-[18px] max-w-[40ch]">
              PerfScope is MIT-licensed and fully open. Self-host it on your own infra, read every line, or send a pull request. Your audits, your data, your call.
            </p>
            <div className="flex gap-3 mt-7 flex-wrap">
              <Button size="lg">
                <GithubIcon className="w-4 h-4" />
                View on GitHub
              </Button>
              <Button size="lg" variant="outline">Read the docs</Button>
            </div>
          </div>

          {/* Right: terminal mock */}
          <div className="rounded-2xl border border-[var(--ld-border-strong)] bg-[var(--ld-bg)] overflow-hidden" style={{ boxShadow: 'var(--ld-shadow-card)' }}>
            {/* Title bar */}
            <div className="flex items-center gap-3 px-[14px] py-[11px] border-b border-[var(--ld-border)] bg-[var(--ld-surface-2)]">
              <span className="flex gap-[6px]">
                {[0, 1, 2].map(i => <i key={i} className="w-[10px] h-[10px] rounded-full bg-[var(--ld-border-strong)] block not-italic" />)}
              </span>
              <span className="font-mono text-[12px] text-[var(--ld-text-3)]">~/perfscope</span>
            </div>

            {/* Body */}
            <div className="p-[18px] grid gap-[7px] font-mono text-[13px] leading-[1.5]">
              <p className="text-[var(--ld-text)] m-0">
                <span className="text-[var(--ld-accent)] mr-2">$</span>
                npx perfscope audit example.com
              </p>
              <p className="text-[var(--ld-text-3)] m-0">✔ Lighthouse run complete</p>
              <p className="text-[var(--ld-text-3)] m-0">
                {'  '}Performance{' '}
                <span className="text-[var(--ld-accent-2)]">94</span>
                {' · '}LCP{' '}
                <span className="text-[var(--ld-accent-2)]">1.2s</span>
                {' · '}CLS{' '}
                <span className="text-[var(--ld-accent-2)]">0.04</span>
              </p>
              <p className="text-[var(--ld-text)] m-0">
                <span className="text-[var(--ld-accent)] mr-2">$</span>
                <span className="ld-cursor">git clone perfscope/perfscope</span>
              </p>
            </div>

            {/* Stats footer */}
            <div className="flex gap-5 flex-wrap px-[18px] py-[14px] border-t border-[var(--ld-border)] bg-[var(--ld-surface-2)]">
              {REPO_STATS.map(({ icon, val, label }) => (
                <span key={label} className="inline-flex items-center gap-[7px] font-mono text-[12.5px] text-[var(--ld-text-2)]">
                  {icon}
                  <b className="text-[var(--ld-text)] font-semibold">{val}</b>
                  {' '}{label}
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
