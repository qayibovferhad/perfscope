import { motion, AnimatePresence } from 'framer-motion';
import { Search, Lock, ShieldCheck, Globe } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { ProgressStepper } from '@/entities/analysis';
import type { AnalysisProgress } from '@/entities/analysis';

interface Props {
  url:           string;
  setUrl:        (v: string) => void;
  isPending:     boolean;
  authSessionId: string | null;
  hasSession:    boolean;
  progress:      AnalysisProgress | null;
  onSubmit:      (e: React.FormEvent) => void;
}

export function AnalyzerSearchForm({
  url, setUrl, isPending, authSessionId, hasSession, progress, onSubmit,
}: Props) {
  return (
    <div className="rounded-[18px] border border-ld-border-strong bg-ld-surface shadow-ld-shadow-card p-[22px]">

      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-bold text-ld-text">Enter a URL to analyze</h2>
        {hasSession && (
          <span className="inline-flex items-center gap-[7px] text-[12.5px] font-semibold text-ld-accent px-[11px] py-[5px] rounded-full border border-ld-accent-line bg-ld-accent-soft">
            <ShieldCheck className="w-[13px] h-[13px]" />
            Session active
          </span>
        )}
      </div>

      {/* Input row */}
      <form onSubmit={onSubmit} className="flex gap-[10px]">
        <Input
          icon={<Globe />}
          mono
          type="text"
          placeholder="https://example.com"
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={isPending}
          spellCheck={false}
          wrapperClassName="flex-1"
          className="py-[14px] text-[15px]"
        />
        <Button
          type="submit"
          disabled={isPending || !url.trim()}
          className="h-auto py-[14px] px-[22px] [&_svg]:w-[16px] [&_svg]:h-[16px]"
        >
          {authSessionId ? <Lock /> : <Search />}
          {isPending ? 'Analyzing…' : 'Analyze'}
        </Button>
      </form>

      <AnimatePresence>
        {isPending && progress && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-5 overflow-hidden"
          >
            <ProgressStepper progress={progress} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
