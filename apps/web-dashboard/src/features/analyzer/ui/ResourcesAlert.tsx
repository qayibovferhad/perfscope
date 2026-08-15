import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import type { ParsedResources } from '@/entities/analysis';

export function ResourcesAlert({ resources }: { resources: ParsedResources }) {
  const criticalCount = resources.requests.filter(r => r.isCritical).length;
  const hasAdvice     = resources.requests.some(r => r.advice);
  if (criticalCount === 0) return null;

  return (
    <Alert variant="warning">
      <AlertTriangle className="w-4 h-4" />
      <AlertTitle>
        {criticalCount} oversized {criticalCount === 1 ? 'resource' : 'resources'} detected
      </AlertTitle>
      <AlertDescription>
        {/* The numbers stay out of this sentence deliberately: they live in
            resource-parser's CRITICAL_THRESHOLDS, and the previous copy still quoted
            "JS > 500 KB, images > 1 MB" long enough for it to be wrong. */}
        {criticalCount === 1
          ? 'One resource is heavy enough to hold up the page on a slow connection.'
          : `${criticalCount} resources are heavy enough to hold up the page on a slow connection.`}
        {hasAdvice && ' Hover the warning icons below for AI-powered optimization tips.'}{' '}
        For accurate results, analyze your production URL — dev builds serve unminified assets.
      </AlertDescription>
    </Alert>
  );
}
