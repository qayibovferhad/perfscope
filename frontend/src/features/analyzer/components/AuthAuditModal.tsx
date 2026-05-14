import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Globe, Loader2, MonitorSmartphone, PlayCircle, LogOut, ShieldCheck, RefreshCw } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useAuthAuditStore } from '@/store/authAuditStore';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';

type Step = 'checking' | 'setup' | 'ready';

interface Props {
  open:        boolean;
  initialUrl?: string;
  isPending:   boolean;
  onClose:     () => void;
  onStart:     (sessionId: string, url: string) => void;
}

export function AuthAuditModal({ open, initialUrl = '', isPending, onClose, onStart }: Props) {
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

    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    setUrl(normalized);
    setLaunching(true);
    setError(null);

    // Close any existing session before opening a new one
    if (sessionId) {
      apiClient.delete(`/auth-audit/session/${sessionId}`).catch(() => {});
    }

    try {
      const { data } = await apiClient.post<{ sessionId: string }>('/auth-audit/session', { url: normalized });
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

  function handleStartAudit() {
    if (!url.trim() || !sessionId) return;
    const normalized = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
    onStart(sessionId, normalized);
    onClose(); // close modal — session stays alive for next time
  }

  function handleEndSession() {
    apiClient.delete(`/auth-audit/session/${sessionId}`).catch(() => {});
    clearSession();
    setSessionId('');
    setStep('setup');
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              <Lock className="w-3.5 h-3.5 text-white" />
            </div>
            Authenticated Audit
          </DialogTitle>
          <DialogDescription>
            Analyze pages behind login — ERP systems, CRM dashboards, admin panels.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait" initial={false}>

          {/* ── Checking stored session ──────────────────────────────── */}
          {step === 'checking' && (
            <motion.div key="checking"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground"
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
                  <label className="text-sm font-medium">Starting URL</label>
                  <Input
                    type="text"
                    placeholder="https://app.example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={launching}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Browser opens here so you can log in. Session stays active until you end it.
                  </p>
                </div>

                {error && (
                  <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
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
              <div className="rounded-xl p-3 flex items-center justify-between"
                style={{ background: 'var(--ps-accent-muted)', border: '1px solid var(--ps-accent-border)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="relative shrink-0">
                    <ShieldCheck className="w-5 h-5" style={{ color: 'var(--ps-accent)' }} />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--ps-text-heading)' }}>
                      Session active
                    </p>
                    <p className="text-xs" style={{ color: 'var(--ps-text-secondary)' }}>
                      Audit any page — no need to log in again.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleEndSession}
                  title="End session"
                  className="p-1.5 rounded-lg transition-colors text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Audit URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Globe className="w-3 h-3" /> Page to audit
                </label>
                <Input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://app.example.com/dashboard"
                  className="text-xs h-8"
                  disabled={isPending}
                  autoFocus
                />
              </div>

              {/* New session button */}
              <button
                onClick={() => setStep('setup')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Open a new browser / re-login
              </button>

              {/* Start audit */}
              <Button
                className="w-full gap-2"
                onClick={handleStartAudit}
                disabled={isPending || !url.trim()}
              >
                {isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                  : <><PlayCircle className="w-4 h-4" /> Start Audit</>
                }
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
