import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Globe, ArrowRight, Lock, Loader2, CheckCircle2, MonitorSmartphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';
import { apiClient } from '@/shared/api/client';
import { useWebsites } from '../hooks/useWebsites';

interface WebsiteForm { url: string; name: string }

type Step = 'form' | 'launching' | 'browser-open' | 'capturing' | 'done';

const inputStyle: React.CSSProperties = {
  background:   'var(--ps-accent-muted)',
  border:       '1px solid var(--ps-panel-border)',
  borderRadius: '0.75rem',
  color:        'var(--ps-text-heading)',
  fontFamily:   'var(--ps-font-sans)',
  fontSize:     '0.875rem',
  outline:      'none',
  width:        '100%',
  padding:      '0.625rem 0.875rem',
  transition:   'border-color 0.15s, box-shadow 0.15s',
};

function iFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'var(--ps-accent-border)';
  e.target.style.boxShadow   = '0 0 0 3px var(--ps-accent-muted)';
}
function iBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'var(--ps-panel-border)';
  e.target.style.boxShadow   = 'none';
}

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function AddWebsiteModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { add, saveSession } = useWebsites();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<WebsiteForm>();

  const [requiresLogin, setRequiresLogin] = useState(false);
  const [step, setStep]                   = useState<Step>('form');
  const [websiteId, setWebsiteId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [error, setError]         = useState<string | null>(null);

  async function onSubmit({ url, name }: WebsiteForm) {
    setError(null);
    const normalized = url.startsWith('http') ? url : `https://${url}`;

    // 1. Save the website
    const website = await add.mutateAsync({ url: normalized, name });
    setWebsiteId(website._id);

    if (!requiresLogin) {
      navigate(`/projects/${website._id}`);
      handleClose();
      return;
    }

    // 2. Launch visible browser for session setup
    setStep('launching');
    try {
      const { data } = await apiClient.post<{ sessionId: string }>('/auth-audit/session', { url: normalized });
      setSessionId(data.sessionId);
      setStep('browser-open');
    } catch {
      setError('Failed to open browser. Make sure the backend is running.');
      setStep('form');
    }
  }

  async function handleSessionDone() {
    setStep('capturing');
    setError(null);
    try {
      // Extract session data from the live browser, then destroy it
      const { data: sessionData } = await apiClient.get<{ cookies: unknown[]; localStorage: Record<string, string> }>(
        `/auth-audit/session/${sessionId}/extract`,
      );
      // Save raw session data to the website document
      await saveSession.mutateAsync({ id: websiteId, sessionData });
      setStep('done');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? 'Failed to capture session. Please try again.');
      setStep('browser-open');
    }
  }

  function handleFinish() {
    navigate(`/projects/${websiteId}`);
    handleClose();
  }

  function handleClose() {
    reset();
    setStep('form');
    setWebsiteId('');
    setSessionId('');
    setError(null);
    setRequiresLogin(false);
    onClose();
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        style={{
          background:           'var(--ps-panel-bg)',
          backdropFilter:       'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border:               '1px solid var(--ps-panel-border)',
          borderRadius:         '1.25rem',
          maxWidth:             440,
        }}
      >
        {/* ── Step: Form ────────────────────────────────────────────── */}
        {step === 'form' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--ps-accent-muted)', border: '1px solid var(--ps-accent-border)' }}>
                  <Globe className="w-3.5 h-3.5" style={{ color: 'var(--ps-accent)' }} />
                </div>
                <div>
                  <DialogTitle style={{ color: 'var(--ps-text-heading)', fontSize: '0.875rem' }}>
                    Add Website
                  </DialogTitle>
                  <DialogDescription style={{ color: 'var(--ps-text-muted)', fontSize: '0.6875rem' }}>
                    Save a website to track its performance over time
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--ps-text-secondary)' }}>
                  Site name <span style={{ color: 'var(--ps-text-muted)' }}>(optional)</span>
                </label>
                <input
                  {...register('name')}
                  style={inputStyle}
                  placeholder="My Portfolio"
                  onFocus={iFocus} onBlur={iBlur}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--ps-text-secondary)' }}>
                  Website URL
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                    style={{ color: 'var(--ps-text-muted)' }} />
                  <input
                    {...register('url', {
                      required: 'URL is required',
                      pattern:  { value: /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/, message: 'Enter a valid URL' },
                    })}
                    style={{ ...inputStyle, fontFamily: 'var(--ps-font-mono)', fontSize: '0.8rem', padding: '0.625rem 0.875rem 0.625rem 2.25rem' }}
                    placeholder="https://example.com"
                    onFocus={iFocus} onBlur={iBlur}
                  />
                </div>
                {errors.url && (
                  <span className="text-[11px] px-1" style={{ color: 'var(--ps-regression)' }}>
                    {errors.url.message}
                  </span>
                )}
              </div>

              {/* Login required toggle */}
              <label className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-xl"
                style={{ background: requiresLogin ? 'rgba(99,102,241,0.08)' : 'var(--ps-accent-muted)', border: '1px solid', borderColor: requiresLogin ? 'var(--ps-accent-border)' : 'var(--ps-panel-border)', transition: 'all 0.15s' }}>
                <input
                  type="checkbox"
                  checked={requiresLogin}
                  onChange={(e) => setRequiresLogin(e.target.checked)}
                  className="mt-0.5 accent-indigo-500 w-4 h-4 shrink-0"
                />
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--ps-text-heading)' }}>
                    <Lock className="w-3 h-3 inline mr-1 mb-0.5" style={{ color: 'var(--ps-accent)' }} />
                    This website requires login
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--ps-text-muted)' }}>
                    A browser will open so you can log in. The session will be saved for future audits.
                  </p>
                </div>
              </label>

              {error && (
                <p className="text-xs px-1" style={{ color: 'var(--ps-regression)' }}>{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--ps-accent-muted)', border: '1px solid var(--ps-panel-border)', color: 'var(--ps-text-secondary)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={add.isPending}
                  className="flex-1 ps-btn-primary flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60">
                  {requiresLogin ? (
                    <><Lock className="w-3.5 h-3.5" /> Add & Setup Session</>
                  ) : (
                    <>Add Website <ArrowRight className="w-3.5 h-3.5" /></>
                  )}
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── Step: Launching browser ───────────────────────────────── */}
        {step === 'launching' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--ps-accent-muted)' }}>
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--ps-accent)' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ps-text-heading)' }}>Opening browser…</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ps-text-muted)' }}>
                A Chrome window will open at your website.
              </p>
            </div>
          </div>
        )}

        {/* ── Step: Browser open, waiting for login ─────────────────── */}
        {step === 'browser-open' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid var(--ps-accent-border)' }}>
                  <MonitorSmartphone className="w-3.5 h-3.5" style={{ color: 'var(--ps-accent)' }} />
                </div>
                <div>
                  <DialogTitle style={{ color: 'var(--ps-text-heading)', fontSize: '0.875rem' }}>
                    Log in to your website
                  </DialogTitle>
                  <DialogDescription style={{ color: 'var(--ps-text-muted)', fontSize: '0.6875rem' }}>
                    A Chrome window has opened at your website
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex flex-col gap-4 mt-2">
              <div className="p-4 rounded-xl space-y-2"
                style={{ background: 'var(--ps-accent-muted)', border: '1px solid var(--ps-panel-border)' }}>
                {['Log in to your account in the Chrome window.', 'Navigate to any page that requires authentication.', 'Come back here and click "Session Captured".'].map((text, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                      style={{ background: 'var(--ps-accent)', color: '#fff' }}>{i + 1}</span>
                    <p className="text-xs" style={{ color: 'var(--ps-text-secondary)' }}>{text}</p>
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-xs px-1" style={{ color: 'var(--ps-regression)' }}>{error}</p>
              )}

              <div className="flex gap-2">
                <button type="button" onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--ps-accent-muted)', border: '1px solid var(--ps-panel-border)', color: 'var(--ps-text-secondary)' }}>
                  Skip
                </button>
                <button type="button" onClick={handleSessionDone}
                  className="flex-1 ps-btn-primary flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Session Captured
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Step: Capturing ───────────────────────────────────────── */}
        {step === 'capturing' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--ps-accent-muted)' }}>
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--ps-accent)' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ps-text-heading)' }}>Saving session…</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ps-text-muted)' }}>
                Capturing cookies and localStorage from the browser.
              </p>
            </div>
          </div>
        )}

        {/* ── Step: Done ────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.12)' }}>
              <CheckCircle2 className="w-6 h-6" style={{ color: '#22c55e' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ps-text-heading)' }}>Session saved!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ps-text-muted)' }}>
                Cookies and localStorage have been saved with this website.
              </p>
            </div>
            <button type="button" onClick={handleFinish}
              className="ps-btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold">
              Go to Project <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
