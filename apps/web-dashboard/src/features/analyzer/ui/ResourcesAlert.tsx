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
        {criticalCount === 1
          ? 'One resource exceeds the recommended size limit.'
          : `${criticalCount} resources exceed recommended size limits (JS > 500 KB, images > 1 MB).`}
        {hasAdvice && ' Hover the warning icons below for AI-powered optimization tips.'}{' '}
        For accurate results, analyze your production URL — dev builds serve unminified assets.
      </AlertDescription>
    </Alert>
  );
}
