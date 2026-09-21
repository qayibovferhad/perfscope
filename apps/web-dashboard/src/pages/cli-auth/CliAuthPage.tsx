import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Terminal, CheckCircle2, XCircle } from 'lucide-react';
import { Dial } from '@/shared/ui/instrument';
import { useAuthStore } from '@/features/auth';
import { apiClient } from '@/shared/api/client';

type State = 'sending' | 'done' | 'error';

export function CliAuthPage() {
  const [params]        = useSearchParams();
  const { token, user } = useAuthStore();
  const navigate        = useNavigate();
  const code = params.get('code');

  // A link with no code is already an error when the page first renders — it was an
  // effect, so the page flashed "Connecting to CLI…" before saying so.
  const [state, setState] = useState<State>(code ? 'sending' : 'error');
  const [errMsg, setErrMsg] = useState(code ? '' : 'Missing login code. Run `perfscope login` again.');

  useEffect(() => {
    if (!code) return;

    if (!token) {
      navigate(`/login?redirect=${encodeURIComponent(`/cli-auth?code=${code}`)}`, { replace: true });
      return;
    }

    apiClient
      .post('/auth/cli/complete', { code })
      .then(() => setState('done'))
      .catch(() => {
        setState('error');
        setErrMsg('Could not send token to CLI. The login code may have expired — run `perfscope login` again.');
      });
  }, [token, code, navigate]);

  return (
    <div className="ps-grid-field-lg min-h-screen flex items-center justify-center bg-ld-bg-2 px-4">
      <div className="flex flex-col items-center gap-[20px] max-w-[380px] w-full text-center">

        {/* The same dial the rest of the product reads scores on, standing in for a
            spinner: while the code is in flight its needle sweeps, and it stops on the
            outcome. One object for all three states, rather than an icon swap. */}
        <Dial
          value={null}
          size="md"
          tone={state === 'error' ? 'poor' : 'accent'}
          pending={state === 'sending'}
          decorative
          glyph={
            state === 'done'
              ? <CheckCircle2 className="w-[24px] h-[24px] text-ld-accent" />
              : state === 'error'
              ? <XCircle className="w-[24px] h-[24px] text-ld-rose" />
              : <Terminal className="w-[24px] h-[24px] text-ld-accent" />
          }
        />

        {state === 'sending' && (
          <>
            <div className="flex flex-col gap-[6px]">
              <h1 className="text-[18px] font-bold text-ld-text">Connecting to CLI…</h1>
              <p className="text-[13px] text-ld-text-3">
                {user?.email
                  ? <span>Signing in as <span className="text-ld-accent-2 font-medium">{user.email}</span></span>
                  : 'Sending credentials to your terminal.'}
              </p>
            </div>
          </>
        )}

        {state === 'done' && (
          <div className="flex flex-col gap-[6px]">
            <h1 className="text-[18px] font-bold text-ld-text">You're logged in!</h1>
            <p className="text-[13px] text-ld-text-3">
              Return to your terminal — the CLI is ready.
            </p>
            <p className="mt-[6px] font-mono text-[12px] bg-ld-surface border border-ld-border rounded-[8px] px-[14px] py-[8px] text-ld-accent-2">
              npx perfscope --url &lt;your-site&gt;
            </p>
          </div>
        )}

        {state === 'error' && (
          <div className="flex flex-col gap-[6px]">
            <h1 className="text-[18px] font-bold text-ld-text">Something went wrong</h1>
            <p className="text-[13px] text-ld-text-3">{errMsg}</p>
          </div>
        )}

        <p className="text-[11px] text-ld-text-3">You can close this tab.</p>
      </div>
    </div>
  );
}
