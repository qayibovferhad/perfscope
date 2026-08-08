import { useRef, useState } from 'react';
import { Globe, Paperclip, AlertCircle, CheckCircle2, RotateCcw, Loader2, ShieldAlert, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { ProgressStepper } from '../../analyzer/components/ProgressStepper';
import { AuthAuditModal } from '@/features/auth-audit/ui/AuthAuditModal';
import type { AnalysisResult, AnalysisProgress } from '@/entities/analysis';
import { getHostname } from '@/entities/website';

type Side = 'target' | 'competitor';

interface Props {
  side:           Side;
  url:            string;
  onUrlChange:    (url: string) => void;
  isLoading:      boolean;
  isSuccess:      boolean;
  isError:        boolean;
  error:          string | null;
  progress:       AnalysisProgress | null;
  data:           AnalysisResult | null;
  onUpload:       (result: AnalysisResult) => void;
  onReset:        () => void;
  onAuthAudit:    (sessionId: string, url: string) => void;
  hasAuthSession?: boolean;
}

const isRivalSide = (side: Side) => side === 'competitor';

export function SideInputBar({
  side, url, onUrlChange,
  isLoading, isSuccess, isError, error,
  progress, data, onUpload, onReset, onAuthAudit, hasAuthSession = false,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const rival = isRivalSide(side);

  const label       = rival ? 'COMPETITOR' : 'YOUR SITE';
  const placeholder = rival ? 'https://competitor.example.com' : 'https://yoursite.example.com';

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string) as AnalysisResult;
        if (!json.metrics || typeof json.metrics.lcp !== 'number') return;
        onUpload(json);
        onUrlChange(json.url ?? '');
      } catch { /* ignore */ }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className={`relative rounded-[16px] border border-ld-border bg-ld-surface overflow-hidden shadow-ld-shadow-card
        ${rival ? '[--ld-accent:var(--ld-amber)] [--ld-accent-soft:rgba(230,162,60,0.13)] [--ld-accent-line:rgba(230,162,60,0.34)]' : ''}`}
    >
      {/* ── 3px top accent bar ─────────────────────────────────────────────── */}
      <div
        className={`h-[3px] ${rival ? 'bg-gradient-to-r from-[var(--ld-amber)] to-[#f0b860]' : 'bg-ld-grad'}`}
      />

      <div className="px-5 pt-[18px] pb-5 flex flex-col gap-3">

        {/* ── Head row ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <span
            className={`flex items-center gap-2 font-mono text-[11.5px] font-semibold tracking-[.1em] uppercase
              ${rival ? 'text-ld-amber' : 'text-ld-accent-2'}`}
          >
            <span
              className={`w-[9px] h-[9px] rounded-full shrink-0 ${rival ? 'bg-ld-amber' : 'bg-ld-accent'}`}
            />
            {label}
          </span>

          {(isSuccess || isError) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onReset}
              className="h-6 px-2 text-[12px] text-ld-text-3 gap-[6px] hover:text-ld-text"
            >
              <RotateCcw className="w-[13px] h-[13px]" />
              Reset
            </Button>
          )}
        </div>

        {/* ── URL input row ─────────────────────────────────────────────────── */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              icon={<Globe />}
              type="text"
              placeholder={placeholder}
              value={url}
              onChange={e => onUrlChange(e.target.value)}
              disabled={isLoading || isSuccess}
              mono
              wrapperClassName={isSuccess ? 'opacity-75' : ''}
            />
            {isLoading && (
              <Loader2 className="w-[14px] h-[14px] absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ld-text-3" />
            )}
          </div>

          {/* Lock (auth) button — competitor side only */}
          {rival && !isSuccess && (
            <button
              type="button"
              title={hasAuthSession ? 'Session active — click to change' : 'Authenticated audit'}
              onClick={() => setAuthModalOpen(true)}
              className={`relative shrink-0 px-3 rounded-[11px] border transition-colors
                ${hasAuthSession
                  ? 'border-[rgba(230,162,60,0.34)] text-ld-amber bg-[rgba(230,162,60,0.13)]'
                  : 'border-ld-border-strong text-ld-text-3'}`}
            >
              <Lock className="w-[14px] h-[14px]" />
              {hasAuthSession && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse bg-ld-amber" />
              )}
            </button>
          )}
        </div>

        {/* ── Upload link ──────────────────────────────────────────────────── */}
        {!isLoading && !isSuccess && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-[6px] text-[11.5px] text-ld-text-3 hover:text-ld-text-2 transition-colors w-fit"
            >
              <Paperclip className="w-[12px] h-[12px]" />
              or upload .json export
            </button>
          </>
        )}

        {/* ── Progress stepper ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {isLoading && progress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <ProgressStepper progress={progress} />
            </motion.div>
          )}
          {isLoading && !progress && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[12px] text-ld-text-3 animate-pulse"
            >
              Connecting to analysis engine…
            </motion.p>
          )}
        </AnimatePresence>

        {/* ── Status: error ────────────────────────────────────────────────── */}
        {isError && error && (
          <div className="flex items-start gap-2 text-[12.5px] text-ld-rose leading-[1.45]">
            <AlertCircle className="w-[14px] h-[14px] shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Status: auth redirect warning ────────────────────────────────── */}
        {isSuccess && data?.authRedirectDetected && (
          <div className="flex items-start gap-2 text-[12.5px] text-ld-amber leading-[1.45]">
            <ShieldAlert className="w-[14px] h-[14px] shrink-0 mt-px" />
            <span>
              <b className="font-semibold">Redirected to a login screen.</b>{' '}
              Results are for the login page, not the URL you requested.{' '}
              <span className="opacity-70">Save a session to audit protected pages.</span>
            </span>
          </div>
        )}

        {/* ── Status: ok ───────────────────────────────────────────────────── */}
        {isSuccess && data && !data.authRedirectDetected && (
          <div className="flex items-center gap-2 text-[12.5px] text-ld-accent-2 leading-[1.45]">
            <CheckCircle2 className="w-[14px] h-[14px] shrink-0 mt-px" />
            <span>
              Ready —{' '}
              <span className="font-medium opacity-80">{getHostname(data.url)}</span>
            </span>
          </div>
        )}
      </div>

      <AuthAuditModal
        open={authModalOpen}
        initialUrl={url}
        onClose={() => setAuthModalOpen(false)}
        onSetUrl={auditUrl => onUrlChange(auditUrl)}
        onAuthAudit={(sessionId, auditUrl) => {
          setAuthModalOpen(false);
          onAuthAudit(sessionId, auditUrl);
        }}
      />
    </div>
  );
}
