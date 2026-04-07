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
    return client.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  static async getInsights(result: AnalysisResult): Promise<string> {
    const model = this.getModel();

    const failingAudits = result.audits
      .slice(0, 5)
      .map((a) => `- ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`)
      .join('\n');

    const prompt = `You are a web performance expert. Analyze the following Lighthouse results and give exactly 3 concise, actionable recommendations in plain language. Be specific and avoid generic advice.

Scores:
- Performance: ${result.scores.performance}/100
- Accessibility: ${result.scores.accessibility}/100
- Best Practices: ${result.scores.bestPractices}/100
- SEO: ${result.scores.seo}/100

Core Web Vitals:
- FCP: ${(result.metrics.fcp / 1000).toFixed(1)}s
- LCP: ${(result.metrics.lcp / 1000).toFixed(1)}s
- TBT: ${Math.round(result.metrics.tbt)}ms
- CLS: ${result.metrics.cls.toFixed(3)}
- TTI: ${(result.metrics.tti / 1000).toFixed(1)}s

Top failing audits:
${failingAudits || 'None'}

Respond with exactly 3 numbered recommendations. Each should start with a clear action verb. Keep each recommendation under 2 sentences.`;

    const response = await model.generateContent(prompt);
    return response.response.text();
  }
}
