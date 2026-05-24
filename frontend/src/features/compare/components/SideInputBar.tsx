import { useRef, useState } from 'react';
import { Paperclip, AlertCircle, CheckCircle2, RotateCcw, Loader2, ShieldAlert, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { ProgressStepper } from '../../analyzer/components/ProgressStepper';
import { AuthAuditModal } from '../../analyzer/components/AuthAuditModal';
import type { AnalysisResult, AnalysisProgress } from '../../analyzer/types';

type Side = 'target' | 'competitor';

interface Props {
  side:          Side;
  url:           string;
  onUrlChange:   (url: string) => void;
  isLoading:     boolean;
  isSuccess:     boolean;
  isError:       boolean;
  error:         string | null;
  progress:      AnalysisProgress | null;
  data:          AnalysisResult | null;
  onUpload:       (result: AnalysisResult) => void;
  onReset:        () => void;
  onAuthAudit:    (sessionId: string, url: string) => void;
  hasAuthSession?: boolean;
}

const CONFIG: Record<Side, { label: string; placeholder: string; dotColor: string; labelColor: string }> = {
  target: {
    label:       'YOUR SITE',
    placeholder: 'Enter your project URL or trace path',
    dotColor:    'bg-indigo-500',
    labelColor:  'text-indigo-400',
  },
  competitor: {
    label:       'COMPETITOR',
    placeholder: 'Enter competitor URL or trace path',
    dotColor:    'bg-orange-500',
    labelColor:  'text-orange-400',
  },
};

export function SideInputBar({
  side, url, onUrlChange,
  isLoading, isSuccess, isError, error,
  progress, data, onUpload, onReset, onAuthAudit, hasAuthSession = false,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cfg     = CONFIG[side];
  const [authModalOpen, setAuthModalOpen] = useState(false);

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
    <div className="flex flex-col gap-3">

      {/* ── Section label ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotColor}`} />
          <span className={`text-[11px] font-bold uppercase tracking-widest ${cfg.labelColor}`}>
            {cfg.label}
          </span>
        </div>
        {(isSuccess || isError) && (
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-1.5 text-[10px] text-muted-foreground gap-1"
            onClick={onReset}
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Reset
          </Button>
        )}
      </div>

      {/* ── URL input ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder={cfg.placeholder}
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            disabled={isLoading || isSuccess}
            className={
              isSuccess
                ? 'border-emerald-500/40 bg-emerald-950/10 text-muted-foreground'
                : isError
                ? 'border-destructive/40'
                : ''
            }
          />
          {isLoading && (
            <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
          )}
        </div>
        {!isSuccess && (
          <button
            type="button"
            title={hasAuthSession ? 'Session active — click to change' : 'Authenticated audit — log in first, then analyze'}
            onClick={() => setAuthModalOpen(true)}
            className="shrink-0 px-2.5 rounded-md border transition-colors relative"
            style={hasAuthSession
              ? { borderColor: 'rgba(34,197,94,0.4)', color: '#22c55e', background: 'rgba(34,197,94,0.08)' }
              : { borderColor: 'rgba(255,255,255,0.1)', color: 'var(--ps-text-muted)' }
            }
          >
            <Lock className="w-3.5 h-3.5" />
            {hasAuthSession && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </button>
        )}
      </div>

      <AuthAuditModal
        open={authModalOpen}
        initialUrl={url}
        onClose={() => setAuthModalOpen(false)}
        onSetUrl={(auditUrl) => {
          onUrlChange(auditUrl);
        }}
        onAuthAudit={(sessionId, auditUrl) => {
          setAuthModalOpen(false);
          onAuthAudit(sessionId, auditUrl);
        }}
      />

      {/* ── Upload link ── */}
      {!isLoading && !isSuccess && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors w-fit"
          >
            <Paperclip className="w-3 h-3" />
            or upload .json export
          </button>
        </>
      )}

      {/* ── Progress ── */}
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
            className="text-xs text-muted-foreground animate-pulse"
          >
            Connecting to analysis engine…
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── Error ── */}
      {isError && error && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Auth redirect warning ── */}
      {isSuccess && data?.authRedirectDetected && (
        <div className="flex items-start gap-2 text-xs bg-amber-500/10 border border-amber-500/25 rounded-md px-3 py-2" style={{ color: '#f59e0b' }}>
          <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            This page redirected to a login screen. Results are for the login page, not the URL you requested.{' '}
            <span className="opacity-70">
              Save a session for this site to audit protected pages.
            </span>
          </span>
        </div>
      )}

      {/* ── Success ── */}
      {isSuccess && data && !data.authRedirectDetected && (
        <div className="flex items-center gap-2 text-[11px] text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            Ready — <span className="font-medium opacity-80">{(() => { try { return new URL(data.url).hostname; } catch { return data.url; } })()}</span>
          </span>
        </div>
      )}
    </div>
  );
}
