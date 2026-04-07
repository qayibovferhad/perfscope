// ─── Analysis Domain Types ──────────────────────────────────────────────────

export type AnalysisStage =
  | 'launching'
  | 'navigating'
  | 'auditing'
  | 'processing'
  | 'complete'
  | 'error';

export type AuditImpact = 'critical' | 'high' | 'medium' | 'low';

export type AnalysisCategory = 'performance' | 'accessibility' | 'best-practices' | 'seo';

export interface AnalysisProgress {
  analysisId: string;
  stage: AnalysisStage;
  progress: number; // 0–100
  message: string;
}

export interface CategoryPartial {
  analysisId: string;
  category: AnalysisCategory;
  score: number;
  metrics?: CoreWebVitals; // only for 'performance'
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

// ─── API Request / Response Types ───────────────────────────────────────────

export interface StartAnalysisBody {
  url: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface StartAnalysisResponse {
  analysisId: string;
  message: string;
}

// ─── Socket Event Types ──────────────────────────────────────────────────────

export interface ServerToClientEvents {
  'analysis:progress': (data: AnalysisProgress) => void;
  'analysis:partial': (data: CategoryPartial) => void;
  'analysis:complete': (result: AnalysisResult) => void;
  'analysis:error': (data: { analysisId: string; message: string }) => void;
}

export interface ClientToServerEvents {
  'analysis:start': (data: { url: string }) => void;
  'analysis:cancel': (data: { analysisId: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  analysisId?: string;
}
