export type AuditImpact = 'critical' | 'high' | 'medium' | 'low';
export type AnalysisStage = 'launching' | 'navigating' | 'auditing' | 'processing' | 'complete' | 'error';
export type AnalysisCategory = 'performance' | 'accessibility' | 'best-practices' | 'seo';

export interface CategoryPartial {
  analysisId: string;
  category: AnalysisCategory;
  score: number;
  metrics?: CoreWebVitals;
  audits: AuditItem[];
}

export interface AuditItem {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue: string | undefined;
  impact: AuditImpact;
}

export interface PerformanceScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

export interface CoreWebVitals {
  fcp: number;
  lcp: number;
  tbt: number;
  cls: number;
  si: number;
  tti: number;
}

export interface AnalysisResult {
  id: string;
  url: string;
  timestamp: string;
  scores: PerformanceScores;
  metrics: CoreWebVitals;
  audits: AuditItem[];
  aiInsights?: string;
}

export interface AnalysisProgress {
  analysisId: string;
  stage: AnalysisStage;
  progress: number;
  message: string;
}
