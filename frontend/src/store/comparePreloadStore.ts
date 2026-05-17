import type { AnalysisResult } from '@/features/analyzer/types';

interface ComparePreload {
  target:     AnalysisResult;
  competitor: AnalysisResult;
}

let _preload: ComparePreload | null = null;

export function setComparePreload(data: ComparePreload) {
  _preload = data;
}

export function consumeComparePreload(): ComparePreload | null {
  const data = _preload;
  _preload = null;
  return data;
}
