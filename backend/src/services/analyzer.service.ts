import { lighthouseService } from './lighthouse.service.js';
import { AiService } from './ai.service.js';
import type { AnalysisResult } from '../types/index.js';

export class AnalyzerService {
  static async analyze(url: string): Promise<AnalysisResult> {
    const result = await lighthouseService.analyze(url);

    if (AiService.isAvailable()) {
      const insights = await AiService.getInsights(result).catch((err: unknown) => {
        console.error('[AI] Failed to get insights:', err);
        return null;
      });
      if (insights) result.aiInsights = insights;
    }

    return result;
  }
}
