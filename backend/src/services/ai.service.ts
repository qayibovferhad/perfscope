import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import type { AnalysisResult } from '../types/index.js';

export class AiService {
  static isAvailable(): boolean {
    return !!config.geminiApiKey;
  }

  private static getModel() {
    if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY is not configured');
    const client = new GoogleGenerativeAI(config.geminiApiKey);
    return client.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  }

  static async getInsights(result: AnalysisResult): Promise<string> {
    const model = this.getModel();

    const failingAudits = result.audits
      .slice(0, 5)
      .map((a) => `- ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`)
      .join('\n');

    const prompt = `Web performance expert. Give exactly 3 numbered actionable fixes for this Lighthouse result. Be specific, max 1 sentence each.

Performance:${result.scores.performance} LCP:${(result.metrics.lcp / 1000).toFixed(1)}s TBT:${Math.round(result.metrics.tbt)}ms CLS:${result.metrics.cls.toFixed(2)}
Issues: ${failingAudits || 'none'}`;

    const response = await model.generateContent(prompt);
    return response.response.text();
  }
}
