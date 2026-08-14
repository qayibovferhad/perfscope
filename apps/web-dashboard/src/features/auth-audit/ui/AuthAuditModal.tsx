import { useState, useEffect, type FormEvent } from 'react';
import type { AuthAuditSessionResponse } from '@perfscope/shared';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Globe, Loader2, MonitorSmartphone, PlayCircle, LogOut, ShieldCheck, RefreshCw } from 'lucide-react';
import { apiClient, BROWSER_LAUNCH_TIMEOUT_MS } from '@/shared/api/client';
import { normalizeUrl } from '@/shared/lib/utils';
import { useAuthAuditStore } from '../model/authAuditStore';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Modal, ModalHeader } from '@/shared/ui/modal';

type Step = 'checking' | 'setup' | 'ready';

interface Props {
  open:          boolean;
  initialUrl?:   string;
  onClose:       () => void;
  onSetUrl:      (url: string) => void;
  /** Called instead of onSetUrl when the caller wants to handle auth-audit emission itself. */
  onAuthAudit?:  (sessionId: string, url: string) => void;
}

export function AuthAuditModal({ open, initialUrl = '', onClose, onSetUrl, onAuthAudit }: Props) {
  const { sessionId: storedId, setSession, clearSession } = useAuthAuditStore();

  const [step,      setStep]      = useState<Step>('checking');
  const [sessionId, setSessionId] = useState('');
  const [url,       setUrl]       = useState(initialUrl);
  const [launching, setLaunching] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // On open: verify stored session is still alive on the backend
  useEffect(() => {
    if (!open) return;
    setUrl(initialUrl);
    setError(null);

    if (!storedId) {
      setStep('setup');
      return;
    }

    setStep('checking');
    apiClient.get(`/auth-audit/session/${storedId}`)
      .then(() => {
        setSessionId(storedId);
        setStep('ready');
      })
      .catch(() => {
        clearSession();
        setSessionId('');
        setStep('setup');
      });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleOpenBrowser(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    const normalized = normalizeUrl(trimmed);
    setUrl(normalized);
    setLaunching(true);
    setError(null);

    // Close any existing session before opening a new one
    if (sessionId) {
      apiClient.delete(`/auth-audit/session/${sessionId}`).catch(() => {});
    }

    try {
      const { data } = await apiClient.post<AuthAuditSessionResponse>(
        '/auth-audit/session', { url: normalized }, { timeout: BROWSER_LAUNCH_TIMEOUT_MS },
      );
      setSessionId(data.sessionId);
      setSession(data.sessionId);  // persist across modal opens
      setStep('ready');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to open browser. Is the backend running?';
      setError(msg);
    } finally {
      setLaunching(false);
    }
  }

  function handleSetUrl() {
    if (!url.trim()) return;
    const normalized = normalizeUrl(url);
    if (onAuthAudit) {
      onAuthAudit(sessionId, normalized);
    } else {
      onSetUrl(normalized);
      onClose();
    }
  }

  function handleEndSession() {
    apiClient.delete(`/auth-audit/session/${sessionId}`).catch(() => {});
    clearSession();
    setSessionId('');
    setStep('setup');
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        icon={<Lock className="w-[22px] h-[22px] text-ld-grad-text" />}
        title="Authenticated Audit"
        subtitle="Analyze pages behind login — ERP systems, CRM dashboards, admin panels."
      />

      <div className="mt-[22px]">
        <AnimatePresence mode="wait" initial={false}>

          {/* ── Checking stored session ──────────────────────────────── */}
          {step === 'checking' && (
            <motion.div key="checking"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center py-8 gap-2 text-sm text-ld-text-3"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking session…
            </motion.div>
          )}

          {/* ── Step 1: No session — open browser ───────────────────── */}
          {step === 'setup' && (
            <motion.div key="setup"
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.2 }}
            >
              <form onSubmit={handleOpenBrowser} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ld-text">Starting URL</label>
                  <Input
                    type="text"
                    placeholder="https://app.example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={launching}
                    autoFocus
                  />
                  <p className="text-xs text-ld-text-3">
                    Browser opens here so you can log in. Session stays active until you end it.
                  </p>
                </div>

                {error && (
                  <p className="text-xs text-ld-rose bg-[rgba(242,100,122,.1)] px-3 py-2 rounded-[10px]">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full gap-2" disabled={launching || !url.trim()}>
                  {launching
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening browser…</>
                    : <><MonitorSmartphone className="w-4 h-4" /> Open Login Window</>
                  }
                </Button>
              </form>
            </motion.div>
          )}

          {/* ── Step 2: Session active — audit any page ──────────────── */}
          {step === 'ready' && (
            <motion.div key="ready"
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Session badge */}
              <div className="rounded-[12px] p-3 flex items-center justify-between bg-ld-accent-soft border border-ld-accent-line">
                <div className="flex items-center gap-2.5">
                  <div className="relative shrink-0">
                    <ShieldCheck className="w-5 h-5 text-ld-accent" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ld-text">Session active</p>
                    <p className="text-xs text-ld-text-2">Audit any page — no need to log in again.</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleEndSession}
                  title="End session"
                  className="hover:text-ld-rose hover:bg-[rgba(242,100,122,.1)]"
                >
                  <LogOut />
                </Button>
              </div>

              {/* Audit URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ld-text-3 flex items-center gap-1.5">
                  <Globe className="w-3 h-3" /> Page to audit
                </label>
                <Input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://app.example.com/dashboard"
                  className="text-xs h-8"
                  autoFocus
                />
              </div>

              {/* New session button */}
              <Button
                variant="link"
                onClick={() => setStep('setup')}
                className="h-auto p-0 gap-1.5 text-xs font-medium text-ld-text-3 hover:text-ld-text"
              >
                <RefreshCw className="w-3 h-3" /> Open a new browser / re-login
              </Button>

              <Button
                className="w-full gap-2"
                onClick={handleSetUrl}
                disabled={!url.trim()}
              >
                <PlayCircle className="w-4 h-4" /> Analyze This Page
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </Modal>
  );
}
