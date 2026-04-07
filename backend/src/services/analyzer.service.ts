import { lighthouseService } from './lighthouse.service.js';
import type { AnalysisResult } from '../types/index.js';

// Static wrapper around LighthouseService for use in HTTP controllers.
// WebSocket handlers use LighthouseService directly (for progress events).
export class AnalyzerService {
  static async analyze(url: string): Promise<AnalysisResult> {
    return lighthouseService.analyze(url);
  }
}
