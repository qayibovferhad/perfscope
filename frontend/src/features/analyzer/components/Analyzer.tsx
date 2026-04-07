import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useAnalysis } from '../hooks/useAnalysis';
import { ScoreCard, type ScoreLabel } from './ScoreCard';
import { MetricsGrid } from './MetricsGrid';
import { AuditList } from './AuditList';
import { AiInsights } from './AiInsights';
import { ProgressStepper } from './ProgressStepper';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
      {children}
    </h2>
  );
}

const SCORE_LABELS: { key: 'performance' | 'accessibility' | 'bestPractices' | 'seo'; label: ScoreLabel }[] = [
  { key: 'performance',   label: 'Performance'     },
  { key: 'accessibility', label: 'Accessibility'   },
  { key: 'bestPractices', label: 'Best Practices'  },
  { key: 'seo',           label: 'SEO'             },
];

export function Analyzer() {
  const [url, setUrl] = useState('');
  const { mutate, data, isPending, isError, error, reset } = useAnalysis();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    reset();
    mutate(normalized);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">PerfScope</h1>
        <p className="text-sm text-muted-foreground">Analyze any website's performance with Lighthouse</p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enter a URL to analyze</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              type="text"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isPending}
              className="flex-1"
            />
            <Button type="submit" disabled={isPending || !url.trim()} className="min-w-[130px]">
              <Search className="w-4 h-4 mr-2" />
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

      {/* Error */}
      {isError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-2 pt-4 pb-4 text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-sm">{error instanceof Error ? error.message : 'Analysis failed'}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <AnimatePresence>
      {data && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="space-y-8"
        >
          <p className="text-xs text-muted-foreground -mb-4">
            Results for{' '}
            <a href={data.url} target="_blank" rel="noreferrer"
              className="font-medium text-foreground underline underline-offset-2">
              {data.url}
            </a>
          </p>

          {/* Scores */}
          <section>
            <SectionTitle>Scores</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SCORE_LABELS.map(({ key, label }) => (
                <ScoreCard key={key} label={label} score={data.scores[key]} />
              ))}
            </div>
          </section>

          {/* AI Insights */}
          {data.aiInsights && <AiInsights insights={data.aiInsights} />}

          {/* Metrics */}
          <section>
            <SectionTitle>Core Web Vitals</SectionTitle>
            <MetricsGrid metrics={data.metrics} />
          </section>

          {/* Audits */}
          {data.audits.length > 0 && (
            <section>
              <SectionTitle>
                Critical Issues ({data.audits.filter((a) => a.impact === 'critical').length}) · Other ({data.audits.filter((a) => a.impact !== 'critical').length})
              </SectionTitle>
              <AuditList audits={data.audits} />
            </section>
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
