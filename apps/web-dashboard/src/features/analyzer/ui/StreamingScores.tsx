import { ScoreCard, ScoreCardSkeleton, type ScoreLabel } from '@/entities/analysis/ui/ScoreCard';
import type { PartialMap } from '../hooks/useAnalysis';

const SCORE_ITEMS: { categoryKey: string; label: ScoreLabel }[] = [
  { categoryKey: 'performance',    label: 'Performance'    },
  { categoryKey: 'accessibility',  label: 'Accessibility'  },
  { categoryKey: 'best-practices', label: 'Best Practices' },
  { categoryKey: 'seo',            label: 'SEO'            },
];

export function StreamingScores({ partials }: { partials: PartialMap }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-[14px]">
      {SCORE_ITEMS.map(({ categoryKey, label }) => {
        const partial = partials[categoryKey as keyof PartialMap];
        return partial
          ? <ScoreCard         key={categoryKey} label={label} score={partial.score} />
          : <ScoreCardSkeleton key={categoryKey} label={label} />;
      })}
    </div>
  );
}
