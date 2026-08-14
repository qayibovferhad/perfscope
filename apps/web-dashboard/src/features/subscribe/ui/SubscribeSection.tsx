import { Check } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { useSubscribe } from '../model/useSubscribe';

export function SubscribeSection() {
  const { email, setEmail, done, invalid, loading, submit } = useSubscribe();

  return (
    <section className="py-[clamp(56px,8vw,96px)]">
      <div className="ld-wrap">
        <form
          onSubmit={submit}
          noValidate
          className="reveal grid grid-cols-1 min-[760px]:grid-cols-[auto_1fr_auto] gap-[clamp(20px,3vw,40px)] items-center rounded-[22px] p-[clamp(30px,4vw,46px)_clamp(28px,4vw,52px)] relative overflow-hidden text-[#04130d] bg-[image:var(--ld-grad)] shadow-[0_24px_70px_-28px_rgba(20,192,138,.55)]"
        >
          {/* Decorative circle */}
          <div className="absolute -right-[60px] -top-[60px] w-[240px] h-[240px] rounded-full bg-white/[.16] pointer-events-none" />

          {/* Mail glyph */}
          <div className="w-14 h-14 rounded-[15px] grid place-items-center bg-[rgba(4,19,13,.14)] relative z-10 shrink-0 max-[760px]:hidden">
            <svg viewBox="0 0 24 24" fill="none" className="w-[27px] h-[27px]">
              <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7"/>
            </svg>
          </div>

          {/* Text */}
          <div className="relative z-10 min-w-0">
            <span className="font-mono text-[11.5px] tracking-[.18em] uppercase font-semibold opacity-70">Stay in the loop</span>
            <h2 className="text-[clamp(22px,2.6vw,32px)] font-extrabold tracking-[-0.025em] leading-[1.1] text-[#04130d] my-2">
              Be first to know when a feature ships.
            </h2>
            <p className="text-[14.5px] max-w-[50ch] text-[rgba(4,19,13,.72)] m-0">
              Regression alerts, CI integrations and new audit capabilities. No spam — one or two notes a month.
            </p>
          </div>

          {/* Action */}
          <div className="relative z-10">
            {!done ? (
              <>
                <div className="flex gap-[9px] max-[760px]:flex-col">
                  <label
                    className={[
                      'flex-1 flex items-center gap-[9px] px-[14px] rounded-xl bg-white/[.92] min-w-[200px] transition-[box-shadow,border-color] duration-200',
                      invalid
                        ? 'border border-[var(--ld-rose)] shadow-[0_0_0_4px_var(--ld-rose-soft)]'
                        : 'border border-transparent',
                    ].join(' ')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="w-[17px] h-[17px] text-[#0c8f66] shrink-0">
                      <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7"/>
                    </svg>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      autoComplete="email"
                      className="flex-1 bg-transparent border-none outline-none text-[#04130d] text-[15px] py-[13px] min-w-0"
                    />
                  </label>
                  <Button type="submit" variant="dark" size="lg" disabled={loading}>
                    {loading ? '···' : 'Subscribe'}
                  </Button>
                </div>
                <p className="font-mono text-[12px] text-[rgba(4,19,13,.6)] mt-3 mb-0">
                  Unsubscribe in one click, anytime.
                </p>
              </>
            ) : (
              <div className="flex items-center gap-[10px] text-[#04130d] font-bold text-[16px]">
                <Check className="w-5 h-5 shrink-0" strokeWidth={2.2} />
                Done — updates are headed to your inbox.
              </div>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
