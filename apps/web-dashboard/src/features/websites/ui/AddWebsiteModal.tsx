import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Globe, ArrowRight, Lock, Loader2, User } from 'lucide-react';
import { Modal, ModalHeader } from '@/shared/ui/modal';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { useWebsites } from '@/entities/website';
import { SessionCaptureModal } from '@/features/auth-audit';

interface WebsiteForm { url: string; name: string }

interface Props { open: boolean; onClose: () => void; }

export function AddWebsiteModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { add } = useWebsites();

  const nameRef = useRef<HTMLInputElement | null>(null);
  const { register, handleSubmit, reset, clearErrors, formState: { errors } } = useForm<WebsiteForm>();
  const nameReg = register('name');

  const [requiresLogin, setRequiresLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the website exists and the login flow should take over.
  const [sessionTarget, setSessionTarget] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => nameRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [open]);

  async function onSubmit({ url, name }: WebsiteForm) {
    setError(null);
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    try {
      const website = await add.mutateAsync({ url: normalized, name });
      if (!requiresLogin) {
        navigate(`/projects/${website._id}`);
        handleClose();
        return;
      }
      setSessionTarget({ id: website._id, url: normalized });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Could not save the website. Please try again.');
    }
  }

  function handleClose() {
    reset();
    setSessionTarget(null);
    setError(null);
    setRequiresLogin(false);
    onClose();
  }

  if (sessionTarget) {
    return (
      <SessionCaptureModal
        open
        websiteId={sessionTarget.id}
        url={sessionTarget.url}
        doneLabel="Go to Project"
        onDone={() => { navigate(`/projects/${sessionTarget.id}`); handleClose(); }}
        onClose={handleClose}
      />
    );
  }

  return (
    <Modal open={open} onClose={handleClose}>

      <ModalHeader
        icon={<Globe className="w-[23px] h-[23px] text-[#04130d]" />}
        title="Add a website"
        subtitle="Save a site to track its performance over time."
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-[18px] mt-[22px]">

          <div className="flex flex-col gap-[7px]">
            <label className="text-[13px] font-semibold text-ld-text flex items-center justify-between gap-[10px]">
              Site name
              <span className="font-mono font-normal text-[10px] tracking-[.08em] uppercase text-ld-text-3 px-[7px] py-[2px] rounded-full border border-ld-border">
                optional
              </span>
            </label>
            <Input
              {...nameReg}
              ref={(el) => { nameReg.ref(el); nameRef.current = el; }}
              icon={<User />}
              placeholder="My Portfolio"
            />
            <span className="text-[11.5px] text-ld-text-3">A friendly label — defaults to the domain if left blank.</span>
          </div>

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

    </Modal>
  );
}
