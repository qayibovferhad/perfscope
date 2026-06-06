import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Globe, ArrowRight, Lock, Loader2, CheckCircle2, MonitorSmartphone, User } from 'lucide-react';
import { Modal, ModalHeader } from '@/shared/ui/modal';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { apiClient } from '@/shared/api/client';
import { useWebsites } from '../hooks/useWebsites';

interface WebsiteForm { url: string; name: string }
type Step = 'form' | 'launching' | 'browser-open' | 'capturing' | 'done';

interface Props { open: boolean; onClose: () => void; }

export function AddWebsiteModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { add, saveSession } = useWebsites();

  const nameRef = useRef<HTMLInputElement | null>(null);
  const { register, handleSubmit, reset, clearErrors, formState: { errors } } = useForm<WebsiteForm>();
  const nameReg = register('name');

  const [requiresLogin, setRequiresLogin] = useState(false);
  const [step, setStep]         = useState<Step>('form');
  const [websiteId, setWebsiteId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => nameRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [open]);

  async function onSubmit({ url, name }: WebsiteForm) {
    setError(null);
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const website = await add.mutateAsync({ url: normalized, name });
    setWebsiteId(website._id);
    if (!requiresLogin) {
      navigate(`/projects/${website._id}`);
      handleClose();
      return;
    }
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
      const { data: sessionData } = await apiClient.get<{ cookies: unknown[]; localStorage: Record<string, string> }>(
        `/auth-audit/session/${sessionId}/extract`,
      );
      await saveSession.mutateAsync({ id: websiteId, sessionData });
      setStep('done');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to capture session. Please try again.');
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

  return (
    <Modal open={open} onClose={handleClose}>

      {/* ── Step: form ─────────────────────────────────────────────── */}
      {step === 'form' && (
        <>
          <ModalHeader
            icon={<Globe className="w-[23px] h-[23px] text-[#04130d]" />}
            title="Add a website"
            subtitle="Save a site to track its performance over time."
          />
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-[18px]">

          {/* Site name */}
          <div className="flex flex-col gap-[7px]">
            <label className="text-[13px] font-semibold text-ld-text flex items-center gap-[7px]">
              Site name
              <span className="font-normal text-ld-text-3 text-[12px]">optional</span>
            </label>
            <Input
              {...nameReg}
              ref={(el) => { nameReg.ref(el); nameRef.current = el; }}
              icon={<User />}
              placeholder="My Portfolio"
            />
            <span className="text-[11.5px] text-ld-text-3">A friendly label — defaults to the domain if left blank.</span>
          </div>

          {/* Website URL */}
          <div className="flex flex-col gap-[7px]">
            <label className="text-[13px] font-semibold text-ld-text">Website URL</label>
            <Input
              {...register('url', {
                required: 'URL is required',
                pattern: {
                  value: /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i,
                  message: 'Enter a valid URL, e.g. https://example.com',
                },
                onChange: () => clearErrors('url'),
              })}
              icon={<Globe />}
              error={!!errors.url}
              mono
              placeholder="https://example.com"
            />
            {errors.url && (
              <span className="text-[11.5px] text-ld-rose">{errors.url.message}</span>
            )}
          </div>

          {/* Auth toggle */}
          <button
            type="button"
            onClick={() => setRequiresLogin(v => !v)}
            className={`flex gap-3 items-start cursor-pointer px-[14px] py-[14px] rounded-[13px] border transition-all duration-200 text-left w-full ${
              requiresLogin
                ? 'bg-ld-accent-soft border-ld-accent-line'
                : 'bg-ld-surface-2 border-ld-border hover:border-ld-border-strong'
            }`}
          >
            <span className={`w-[21px] h-[21px] rounded-[6px] shrink-0 border-[1.5px] grid place-items-center transition-all duration-200 mt-[1px] ${
              requiresLogin ? 'bg-ld-accent border-ld-accent' : 'bg-ld-bg-2 border-ld-border-strong'
            }`}>
              <svg viewBox="0 0 24 24" fill="none" className={`w-[14px] h-[14px] text-[#04130d] transition-all duration-200 ${requiresLogin ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="flex flex-col gap-1">
              <span className="flex items-center gap-[7px] text-[13.5px] font-semibold text-ld-text">
                <Lock className="w-[14px] h-[14px] text-ld-accent shrink-0" />
                This website requires login
              </span>
              <span className="text-[12px] text-ld-text-2 leading-[1.5]">
                A browser window opens so you can sign in. The session is saved for future audits.
              </span>
            </span>
          </button>

          {error && <p className="text-[12px] text-ld-rose">{error}</p>}

          <div className="flex gap-[10px] mt-1">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={add.isPending}>
              {add.isPending ? (
                <Loader2 className="animate-spin" />
              ) : requiresLogin ? (
                <><Lock />Add & Setup Session</>
              ) : (
                <>Add website <ArrowRight /></>
              )}
            </Button>
          </div>
        </form>
        </>
      )}

      {/* ── Step: launching ────────────────────────────────────────── */}
      {step === 'launching' && (
        <div className="flex flex-col items-center gap-5 py-8 text-center">
          <span className="w-[46px] h-[46px] rounded-[13px] grid place-items-center bg-ld-grad shadow-ld-glow">
            <Loader2 className="w-[23px] h-[23px] text-[#04130d] animate-spin" />
          </span>
          <div>
            <p className="text-[16px] font-bold text-ld-text">Opening browser…</p>
            <p className="text-[13px] text-ld-text-2 mt-1.5">A Chrome window will open at your website.</p>
          </div>
        </div>
      )}

      {/* ── Step: browser-open ─────────────────────────────────────── */}
      {step === 'browser-open' && (
        <>
          <ModalHeader
            icon={<MonitorSmartphone className="w-[23px] h-[23px] text-[#04130d]" />}
            title="Sign in to your website"
            subtitle="Log in in the Chrome window, then confirm below."
          />
          <div className="flex flex-col gap-[18px] mt-[18px]">
          <div className="flex flex-col gap-3 p-4 rounded-[13px] border border-ld-border bg-ld-surface-2">
            {[
              'Log in to your account in the Chrome window.',
              'Navigate to any page that requires authentication.',
              'Come back here and click "Session Captured".',
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold shrink-0 mt-0.5 bg-ld-grad text-[#04130d]">
                  {i + 1}
                </span>
                <p className="text-[13px] text-ld-text-2">{text}</p>
              </div>
            ))}
          </div>
          {error && <p className="text-[12px] text-ld-rose">{error}</p>}
          <div className="flex gap-[10px]">
            <Button type="button" variant="outline" onClick={handleClose}>Skip</Button>
            <Button type="button" className="flex-1" onClick={handleSessionDone}>
              <CheckCircle2 /> Session Captured
            </Button>
          </div>
          </div>
        </>
      )}

      {/* ── Step: capturing ────────────────────────────────────────── */}
      {step === 'capturing' && (
        <div className="flex flex-col items-center gap-5 py-8 text-center">
          <span className="w-[46px] h-[46px] rounded-[13px] grid place-items-center bg-ld-grad shadow-ld-glow">
            <Loader2 className="w-[23px] h-[23px] text-[#04130d] animate-spin" />
          </span>
          <div>
            <p className="text-[16px] font-bold text-ld-text">Saving session…</p>
            <p className="text-[13px] text-ld-text-2 mt-1.5">Capturing cookies and localStorage from the browser.</p>
          </div>
        </div>
      )}

      {/* ── Step: done ─────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="flex flex-col items-center gap-5 py-8 text-center">
          <span className="w-[46px] h-[46px] rounded-[13px] grid place-items-center bg-ld-accent-soft shadow-ld-ring-accent">
            <CheckCircle2 className="w-[23px] h-[23px] text-ld-accent" />
          </span>
          <div>
            <p className="text-[16px] font-bold text-ld-text">Session saved!</p>
            <p className="text-[13px] text-ld-text-2 mt-1.5">
              Cookies and localStorage have been saved with this website.
            </p>
          </div>
          <Button onClick={handleFinish}>
            Go to Project <ArrowRight />
          </Button>
        </div>
      )}

    </Modal>
  );
}
