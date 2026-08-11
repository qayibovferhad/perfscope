import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, MonitorSmartphone, RotateCcw } from 'lucide-react';
import { Modal, ModalHeader } from '@/shared/ui/modal';
import { Button } from '@/shared/ui/button';
import { apiClient, BROWSER_LAUNCH_TIMEOUT_MS } from '@/shared/api/client';
import { useWebsites } from '@/entities/website';

type Step = 'launching' | 'browser-open' | 'capturing' | 'done';

interface Props {
  open:       boolean;
  websiteId:  string;
  url:        string;
  onClose:    () => void;
  /** Label + handler for the button on the success step. Falls back to just closing. */
  doneLabel?: string;
  onDone?:    () => void;
}

/**
 * Drives the login-protected ("lock") flow for a website that already exists:
 * opens a visible Chrome window, waits for the user to sign in, then harvests
 * cookies + localStorage and stores them on the website document.
 */
export function SessionCaptureModal({ open, websiteId, url, onClose, doneLabel, onDone }: Props) {
  const { saveSession } = useWebsites();

  const [step,      setStep]      = useState<Step>('launching');
  const [sessionId, setSessionId] = useState('');
  const [error,     setError]     = useState<string | null>(null);

  // Every POST spawns a real Chrome window, so the launch must fire exactly once
  // per open. StrictMode runs effects twice in dev, which otherwise opens two.
  const launched  = useRef(false);
  // Read by the unmount cleanup, which cannot see the latest state value.
  const sessionRef = useRef('');

  const launch = useCallback(async () => {
    setStep('launching');
    setError(null);
    setSessionId('');
    sessionRef.current = '';
    try {
      const { data } = await apiClient.post<{ sessionId: string }>(
        '/auth-audit/session', { url }, { timeout: BROWSER_LAUNCH_TIMEOUT_MS },
      );
      sessionRef.current = data.sessionId;
      setSessionId(data.sessionId);
      setStep('browser-open');
    } catch {
      setError('Failed to open browser. Make sure the backend is running.');
    }
  }, [url]);

  // The browser launches as soon as the modal opens — there is nothing to confirm first.
  useEffect(() => {
    if (!open) { launched.current = false; return; }
    if (launched.current) return;
    launched.current = true;
    void launch();
  }, [open, launch]);

  /** Shuts the Chrome window down — the harvested cookies already live on the website doc. */
  function discardBrowser() {
    const id = sessionRef.current;
    if (!id) return;
    sessionRef.current = '';
    apiClient.delete(`/auth-audit/session/${id}`).catch(() => {});
  }

  function handleClose() {
    discardBrowser();
    onClose();
  }

  function handleDone() {
    discardBrowser();
    (onDone ?? onClose)();
  }

  function handleRetry() {
    discardBrowser();
    void launch();
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

  return (
    <Modal open={open} onClose={handleClose}>

      {/* ── Step: launching ────────────────────────────────────────── */}
      {step === 'launching' && !error && (
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

      {/* ── Step: launching failed ─────────────────────────────────── */}
      {step === 'launching' && error && (
        <div className="flex flex-col items-center gap-5 py-8 text-center">
          <span className="w-[46px] h-[46px] rounded-[13px] grid place-items-center border border-ld-border bg-ld-surface-2">
            <AlertCircle className="w-[23px] h-[23px] text-ld-rose" />
          </span>
          <div>
            <p className="text-[16px] font-bold text-ld-text">Could not open the browser</p>
            <p className="text-[13px] text-ld-text-2 mt-1.5">{error}</p>
          </div>
          <div className="flex gap-[10px]">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="button" onClick={handleRetry}>
              <RotateCcw /> Try again
            </Button>
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
          <Button onClick={handleDone}>
            {doneLabel ?? 'Done'}
            {onDone && <ArrowRight />}
          </Button>
        </div>
      )}

    </Modal>
  );
}
