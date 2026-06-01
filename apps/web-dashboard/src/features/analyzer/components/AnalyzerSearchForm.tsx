import { motion, AnimatePresence } from 'framer-motion';
import { Search, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { ProgressStepper } from './ProgressStepper';
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Enter a URL to analyze</CardTitle>
          {hasSession && (
            <span
              className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Session active
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            type="text"
            placeholder="https://example.com"
            value={url}
            onChange={e => setUrl(e.target.value)}
            disabled={isPending}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={isPending || !url.trim()}
            className="min-w-[130px] gap-2"
          >
            {authSessionId ? <Lock className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            {isPending ? 'Analyzing...' : 'Analyze'}
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
      </CardContent>
    </Card>
  );
}
