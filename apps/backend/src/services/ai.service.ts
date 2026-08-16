import { GoogleGenerativeAI } from '@google/generative-ai';
import { createHash } from 'node:crypto';
import { config } from '../config/index.js';
import { rateVital, VITAL_THRESHOLDS, fmtMs } from '@perfscope/shared';
import type {
  AnalysisResult, NetworkRequest, AiAdvice, AiAdviceAction, AiMetricNotes, AiPageAnalysis,
  CoreWebVitals,
} from '@perfscope/shared';
import type { RecommendationHistoryEntry } from './aiRecommendation.service.js';
import type { PreviousRun } from './previousRun.service.js';
import { diffResources, resourceDiffHasChanges } from '../lib/resourceDiff.js';
import { attributeLongTasks } from '../lib/longTaskAttribution.js';

/** Identical prompt in, identical text out — so retries and re-saves cost nothing. */
const CACHE_TTL_MS = 6 * 60 * 60_000;
const CACHE_MAX    = 300;

/**
 * How every prompt in this file is told to write.
 *
 * Six prompts grew independently and ended up in six registers — a numbered command list,
 * subjectless fragments ("Delayed by heavy script execution"), flowing prose, semicolon
 * instructions — so the product read as six tools rather than one assistant. This is the
 * single answer to "what does PerfScope sound like".
 */
const VOICE = `Write as one consistent assistant:
- Address the reader as "you" and their site as "your". Plain sentences, no markdown, no numbered lists, no headings.
- Durations in seconds above 1000ms ("3.79s"), otherwise milliseconds ("240ms"). Never write a raw millisecond figure like "3787 milliseconds".
- Never restate what a metric or an audit means. Say what it means for THIS page.
- One idea per sentence. No filler, no "consider", no "it is recommended".`;

export class AiService {
  static isAvailable(): boolean {
    return !!config.geminiApiKey;
  }

  /**
   * Google's rolling alias, not a pinned version. `gemini-2.0-flash-lite` was retired and
   * every audit logged a 404 for weeks with nobody noticing; when this was fixed,
   * `gemini-2.5-flash-lite` was *listed* by the models endpoint and already 404ing too.
   * The alias moves with them. If Google ever drops it, ListModels is the place to look.
   */
  private static readonly MODEL = 'gemini-flash-lite-latest';

  private static getModel() {
    if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY is not configured');
    const client = new GoogleGenerativeAI(config.geminiApiKey);
    return client.getGenerativeModel({ model: this.MODEL });
  }

  private static readonly cache = new Map<string, { text: string; expiresAt: number }>();

  /**
   * The single door to Gemini. Every prompt goes through here so the fence-stripping,
   * the cache and the deadline are written once rather than per method.
   *
   * `timeoutMs` matters for the callers a person is waiting behind — an alert must go out
   * whether or not the model has anything to say about it.
   */
  private static async generate(prompt: string, opts: { timeoutMs?: number } = {}): Promise<string> {
    const key = createHash('sha256').update(this.MODEL).update('\0').update(prompt).digest('hex');
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.text;

    const model = this.getModel();
    const call  = model.generateContent(prompt).then(r => r.response.text());

    const raw = opts.timeoutMs === undefined ? await call : await Promise.race([
      call,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini timed out after ${opts.timeoutMs}ms`)), opts.timeoutMs).unref()),
    ]);

    // Models fence JSON even when told not to; strip it once, here, for everyone.
    const text = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

    // An empty answer is not an answer worth remembering. Caching one would turn a single
    // blank or refused response into six hours of silence for that exact prompt, and every
    // caller treats empty as "nothing to say" rather than "ask again".
    if (!text) return text;

    if (this.cache.size >= CACHE_MAX) {
      const now = Date.now();
      for (const [k, v] of this.cache) if (v.expiresAt <= now) this.cache.delete(k);
      if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
    }
    this.cache.set(key, { text, expiresAt: Date.now() + CACHE_TTL_MS });
    return text;
  }

  /** Parse a fenced-or-bare JSON reply; `null` rather than a throw when the model rambles. */
  private static parseJson<T>(text: string, label: string): T | null {
    try {
      return JSON.parse(text) as T;
    } catch {
      console.error(`[AI] Failed to parse ${label} JSON:`, text.slice(0, 200));
      return null;
    }
  }

/**
   * One pass over an audit, producing everything the analyzer shows.
   *
   * Replaces `getInsights`, `getPageNarrative` and `getAuditExplanations`, which each made
   * their own request and each saw only their own slice — so the same load got three
   * different explanations with three different timestamps. Deriving all of it from one
   * `diagnosis` makes agreement structural rather than lucky, and costs one call where
   * there were three.
   */
  /**
   * The exact evidence `analysePage` reasons over, as one block of text: scores, vitals,
   * longest tasks, heaviest resources, layout shifts, vendors, libraries, recommendation
   * history, and every failing audit with the details phase 1 taught `lhr-transform` to
   * keep. Split out so `answerQuestion` can put the identical context in front of the
   * model — the point of the question box is that it sees exactly what the analysis saw,
   * not a fresh, cheaper summary of the same page.
   */
  private static buildPageContext(
    result: AnalysisResult,
    previous?: PreviousRun | null,
    history?: RecommendationHistoryEntry[] | null,
  ): { context: string; failing: AnalysisResult['audits']; poor: (keyof CoreWebVitals)[] } {
    const vitals = (Object.keys(VITAL_THRESHOLDS) as (keyof CoreWebVitals)[])
      .filter(k => k in result.metrics);
    const poor = vitals.filter(k => rateVital(k, result.metrics[k]) !== 'good');

    const failing = result.audits
      .filter(a => (a.score ?? 1) < 1)
      .slice(0, this.AUDIT_LIMIT);

    const short = (url?: string) => {
      if (!url) return '';
      try { return ' ' + new URL(url).pathname; } catch { return ' ' + url; }
    };

    const heaviest = [...(result.resources?.requests ?? [])]
      .sort((a, b) => b.transferSize - a.transferSize)
      .slice(0, 8)
      .map(r => `  ${r.resourceType}${short(r.url)} ${Math.round(r.transferSize / 1024)}KB starts ${Math.round(r.startTime)}ms ttfb ${Math.round(r.ttfb)}ms`)
      .join('\n');

    // The specifics that make advice about *this* page rather than about web performance:
    // which function blocked the thread, which element moved, which library is on board.
    // All of it is already in the result and none of it used to reach the model, which is
    // why every audit came back with the same few sentences about third-party scripts.
    //
    // A long task and a resource used to be two unrelated lists — attributeLongTasks
    // chains them: which script was this task actually running, directly (the trace
    // named it) or inferred (a script's download/execute window overlapped it). The
    // model gets to cite a specific file instead of a bare "250ms scripting task".
    const attributedTasks = attributeLongTasks(
      [...(result.flameChartData?.events ?? [])]
        .filter(e => e.isLongTask)
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 6)
        .map(e => ({ name: e.name, startMs: e.startMs, durationMs: e.durationMs, ...(e.url ? { url: e.url } : {}) })),
      (result.resources?.requests ?? []).map(r => ({
        url: r.url, resourceType: r.resourceType, transferSize: r.transferSize,
        startTime: r.startTime, endTime: r.endTime,
      })),
    );

    const longTasks = attributedTasks.map(t => {
      const base = `  ${Math.round(t.durationMs)}ms ${t.name} at ${Math.round(t.startMs)}ms`;
      if (!t.resource) return base;
      const size = `${Math.round(t.resource.transferSize / 1024)}KB`;
      return t.resource.direct
        ? `${base} —${short(t.resource.url)} (${size})`
        : `${base} — likely ${t.resource.resourceType}${short(t.resource.url)} (${size}), downloading/executing at this time`;
    }).join('\n');

    const shifts = (result.clsData?.elements ?? [])
      .filter(e => e.score > 0)
      .slice(0, 4)
      .map(e => `  ${e.score.toFixed(3)} ${e.selector}${e.rootCause ? ` (${e.rootCause})` : ''}`)
      .join('\n');

    const vendors = (result.thirdParty ?? [])
      .slice(0, 5)
      .map(t => `  ${t.name}: ${Math.round(t.blockingTime)}ms blocking, ${Math.round(t.transferSize / 1024)}KB over ${t.requestCount} requests`)
      .join('\n');

    const libraries = (result.resources?.detectedLibraries ?? []).map(l => l.name).join(', ');
    const s = result.scores;

    // Not just "the score moved" but "moved because you shipped this" — the same
    // instinct as phase 1's audit details, applied to the comparison instead of the
    // single audit. Only computed when both sides actually have a resource list to
    // diff (an old stored run from before phase 1's fields existed still compares on
    // scores/metrics alone, same as before this existed).
    const changeSince = previous?.resources && result.resources
      ? (() => {
          const diff = diffResources(
            {
              requests: result.resources!.requests,
              detectedLibraries: result.resources!.detectedLibraries,
              thirdParty: result.thirdParty ?? [],
            },
            previous.resources,
          );
          if (!resourceDiffHasChanges(diff)) return '';

          const fmtKB = (b: number) => `${Math.round(b / 1024)}KB`;
          const name  = (url: string) => short(url).trim() || url;
          const lines: string[] = [];
          if (diff.added.length)   lines.push(`  Added: ${diff.added.map(r => `${name(r.url)} (${fmtKB(r.transferSize)})`).join(', ')}`);
          if (diff.removed.length) lines.push(`  Removed: ${diff.removed.map(r => name(r.url)).join(', ')}`);
          if (diff.grown.length)   lines.push(`  Grew: ${diff.grown.map(r => `${name(r.url)} ${fmtKB(r.fromBytes)}→${fmtKB(r.toBytes)}`).join(', ')}`);
          if (diff.shrunk.length)  lines.push(`  Shrunk: ${diff.shrunk.map(r => `${name(r.url)} ${fmtKB(r.fromBytes)}→${fmtKB(r.toBytes)}`).join(', ')}`);
          if (diff.librariesAdded.length)   lines.push(`  New libraries: ${diff.librariesAdded.join(', ')}`);
          if (diff.librariesRemoved.length) lines.push(`  Removed libraries: ${diff.librariesRemoved.join(', ')}`);
          if (diff.vendorsAdded.length)     lines.push(`  New vendors: ${diff.vendorsAdded.join(', ')}`);
          if (diff.vendorsRemoved.length)   lines.push(`  Removed vendors: ${diff.vendorsRemoved.join(', ')}`);
          return `\nWhat changed since that run:\n${lines.join('\n')}\n`;
        })()
      : '';

    const context = `URL: ${result.url}
${previous ? `Previous run (${previous.at}): performance ${previous.scores.performance}, LCP ${fmtMs(previous.metrics.lcp)}, TBT ${fmtMs(previous.metrics.tbt)}, CLS ${previous.metrics.cls.toFixed(3)}\n` : 'No earlier audit of this page to compare against.\n'}${changeSince}Scores: performance ${s.performance}, accessibility ${s.accessibility}, best practices ${s.bestPractices}, SEO ${s.seo}
LCP ${fmtMs(result.metrics.lcp)}, TBT ${fmtMs(result.metrics.tbt)}, CLS ${result.metrics.cls.toFixed(3)}, FCP ${fmtMs(result.metrics.fcp)}, TTI ${fmtMs(result.metrics.tti)}
${result.resources ? `${result.resources.requests.length} requests, ${result.resources.thirdPartyRequests.length} of them third-party` : ''}
${libraries ? `Libraries on the page: ${libraries}` : ''}
${history && history.length > 0 ? `\nRecommendations given before on this page:\n${history.map(h => `  ${h.resolved ? '[now fixed] ' : `[given ${h.timesGiven}x, still open] `}${h.fix}`).join('\n')}\n` : ''}

Longest main-thread tasks:
${longTasks || '  (none over the long-task threshold)'}

Heaviest resources:
${heaviest || '  (none recorded)'}

Layout shifts:
${shifts || '  (none)'}

Third-party vendors:
${vendors || '  (none)'}

Failing audits:
${failing.map(a => {
  const savings = [
    a.savingsMs    ? `~${a.savingsMs}ms`                              : null,
    a.savingsBytes ? `~${Math.round(a.savingsBytes / 1024)}KB` : null,
  ].filter(Boolean).join(', ');
  const head = `  ${a.id} — ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}${savings ? ` [potential savings: ${savings}]` : ''}`;
  const items = (a.details ?? []).map(d => {
    const bits = [
      d.selector,
      d.snippet && d.snippet !== d.selector ? d.snippet : undefined,
      d.url,
      d.value,
    ].filter(Boolean);
    return bits.length ? `    ${bits.join('  ')}` : null;
  }).filter((l): l is string => l !== null);
  return items.length ? `${head}\n${items.join('\n')}` : head;
}).join('\n') || '  (none)'}`;

    return { context, failing, poor };
  }

  static async analysePage(
    result: AnalysisResult,
    /**
     * The previous audit of this same URL, when there is one.
     *
     * Without it every run of an unchanged page produces the same paragraph, which is
     * correct and useless — the reader has read it already. Told what moved, the analysis
     * leads with the movement, which is different every time by definition and is the
     * thing someone re-auditing actually wants to know.
     */
    previous?: PreviousRun | null,
    /**
     * Fixes already given for this page, oldest concern first. Without this every audit
     * re-derives the same three fixes from scratch and repeats them verbatim for as long
     * as the user leaves the underlying problem alone — indistinguishable, to the reader,
     * from the AI not having noticed it said this already.
     */
    history?: RecommendationHistoryEntry[] | null,
  ): Promise<AiPageAnalysis | null> {
    const { context, failing, poor } = this.buildPageContext(result, previous, history);
    const s = result.scores;
    const weakCategories = [
      s.accessibility < 90 ? `accessibility ${s.accessibility}` : null,
      s.bestPractices < 90 ? `best practices ${s.bestPractices}` : null,
      s.seo < 90 ? `SEO ${s.seo}` : null,
    ].filter(Boolean);

    const prompt = `You are a web performance expert reading one Lighthouse result.

${VOICE}

Work out what is actually wrong with this page FIRST, then make everything else agree with it. Do not offer competing explanations for the same slow metric.

${previous ? `Something has changed or it has not, and that is the first thing the reader wants: open the diagnosis with the movement since the previous run, naming the metric that moved most. If nothing moved meaningfully, say so plainly rather than inventing a change. If "What changed since that run" below names a file, vendor or library, that is WHY the metric moved — say so by name, not just that the metric moved. If nothing there explains the movement, don't invent a cause; the movement can be real without a clean explanation on this page (a slow day on the network, a third party's own release).\n` : ''}Be specific to the evidence below. Name the function, the file, the element or the vendor when the data gives you one — advice that would fit any website is worth nothing here. When a failing audit lists a selector or a filename, quote it exactly as given (e.g. "img.Image-styles__ImageStyled-sc-8c99a12b-0", "pubads_impl.js") rather than describing the element in your own words — a developer searches their codebase for that literal string, not a paraphrase of it. A long task marked "likely" a script is a timing overlap, not a proven cause — you may still name the file (it is the best evidence available), but don't claim certainty the data doesn't have; a task with no file at all just say what kind of work it was.${weakCategories.length ? ` This page is also weak on ${weakCategories.join(' and ')}; cover that too, not only speed.` : ''}
${history && history.length > 0 ? `\nSome of the fixes below may repeat what you told this reader before — see "Recommendations given before" below. If one you flagged is no longer needed, lead a fix with that: say plainly that it's fixed now. If a fix you are about to give matches one already given (timesGiven ≥ 1), do not present it as new — say plainly that this is a repeat ("again", "still open", "as before") rather than writing the sentence as if for the first time. If it has been given 2 or more times already (this would be its third audit or later), go further: explain it a different way, say why it matters more than they may think, or say plainly that it is a hard change to make. Never restate a past fix verbatim.\n` : ''}

Answer ONLY with JSON:
{"diagnosis": string, "fixes": [string], "metrics": {${poor.map(k => `"${k}": string`).join(', ')}}, "waterfall": string, "audits": {${failing.map(a => `"${a.id}": string`).join(', ')}}}

- diagnosis: one sentence naming the single root problem on this page.
- fixes: between 3 and 6, ordered by impact, one sentence each. Cover every weak area, not just the slowest metric. When a failing audit below states a potential savings in ms or KB, weigh that real number over your own sense of what looks worse — a 900ms opportunity outranks a 40ms one even if the smaller one sounds scarier described in words.
- metrics: one sentence per key, saying what made THAT metric what it is here — consistent with the diagnosis.
- waterfall: two or three sentences on how this load actually went, in order.
- audits: one sentence per key: why it fails on this page and the first thing to change. Never define the audit.
${poor.length === 0 ? '- Every vital is already good, so "metrics" is {}.\n' : ''}${failing.length === 0 ? '- Nothing is failing, so "audits" is {}.\n' : ''}
${context}`;

    const parsed = this.parseJson<{
      diagnosis?: unknown; fixes?: unknown; metrics?: unknown; waterfall?: unknown; audits?: unknown;
    }>(await this.generate(prompt), 'page analysis');

    if (!parsed || typeof parsed.diagnosis !== 'string' || !parsed.diagnosis.trim()) return null;

    /** Keep only the keys we asked about, so a hallucinated metric cannot reach the UI. */
    const pick = (raw: unknown, allowed: string[]): Record<string, string> => {
      if (!raw || typeof raw !== 'object') return {};
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (allowed.includes(k) && typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 300);
      }
      return out;
    };

    return {
      diagnosis: parsed.diagnosis.trim().slice(0, 300),
      fixes: (Array.isArray(parsed.fixes) ? parsed.fixes : [])
        .filter((f): f is string => typeof f === 'string' && !!f.trim())
        .slice(0, 6).map(f => f.trim().slice(0, 300)),
      metrics:   pick(parsed.metrics, poor) as AiMetricNotes,
      waterfall: typeof parsed.waterfall === 'string' && parsed.waterfall.trim()
        ? parsed.waterfall.trim().slice(0, 600) : null,
      audits:    pick(parsed.audits, failing.map(a => a.id)),
    };
  }

  /**
   * Answers one question about one audit — the analyzer's monologue, made answerable.
   *
   * Deliberately not a chatbot: no conversation history is kept (each call is independent
   * and costs one Gemini request, which `generate`'s own 6h cache already covers for a
   * repeated question), and the model sees exactly the evidence `analysePage` saw and
   * nothing else. A question about something this audit did not measure gets told so,
   * rather than an answer drawn from general web-performance knowledge that would read as
   * if it came from this page's own data.
   */
  static async answerQuestion(
    result: AnalysisResult,
    question: string,
    previous?: PreviousRun | null,
    history?: RecommendationHistoryEntry[] | null,
  ): Promise<string | null> {
    const { context } = this.buildPageContext(result, previous, history);

    const prompt = `You are a web performance expert. Someone is looking at this Lighthouse result and has asked a question about it.

${VOICE}

Answer using ONLY the evidence below — this audit's own data, not general web-performance knowledge beyond what is needed to interpret these numbers. If the question asks about something this audit did not measure or does not contain, say plainly that this audit doesn't have that information, rather than guessing or answering in general terms.

Answer in 1 to 3 sentences. Plain text — no JSON, no markdown, no headings.

${context}

Question: ${question}`;

    const raw = await this.generate(prompt);
    const answer = raw.trim();
    return answer ? answer.slice(0, 600) : null;
  }

  static async getInsights(result: AnalysisResult): Promise<string> {
    const failingAudits = result.audits
      .slice(0, 5)
      .map((a) => `- ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`)
      .join('\n');

    const prompt = `Web performance expert. Give exactly 3 numbered actionable fixes for this Lighthouse result. Be specific, max 1 sentence each.

Performance:${result.scores.performance} LCP:${(result.metrics.lcp / 1000).toFixed(1)}s TBT:${Math.round(result.metrics.tbt)}ms CLS:${result.metrics.cls.toFixed(2)}
Issues: ${failingAudits || 'none'}`;

    return this.generate(prompt);
  }

  /**
   * For each critical resource, returns a Map<url, advice> with a
   * short (≤15 words) optimization tip generated by Gemini.
   */
  static async getResourceAdvice(
    resources: Pick<NetworkRequest, 'url' | 'resourceType' | 'transferSize'>[],
  ): Promise<Map<string, string>> {
    if (resources.length === 0) return new Map();

    const list = resources
      .map((r, i) => {
        const kb = Math.round(r.transferSize / 1024);
        let pathname = r.url;
        try { pathname = new URL(r.url).pathname; } catch { /* keep full url */ }
        return `${i + 1}. [${r.resourceType}] ${pathname} (${kb} KB)`;
      })
      .join('\n');

    const prompt = `Web performance expert. For each oversized resource below give exactly one actionable optimization tip (max 15 words). Respond ONLY as a JSON array with objects {index, advice}. No markdown, no prose.

Resources:
${list}`;

    const parsed = this.parseJson<Array<{ index: number; advice: string }>>(
      await this.generate(prompt), 'resource advice');
    if (!Array.isArray(parsed)) return new Map();

    return new Map(
      parsed
        .filter((e) => e.index >= 1 && e.index <= resources.length && typeof e.advice === 'string')
        .map(({ index, advice }) => [resources[index - 1]!.url, advice.slice(0, 200)]),
    );
  }
  // ─── Deepening one audit ────────────────────────────────────────────────────

  /** Explaining a passing audit costs a token and says nothing. */
  /** Failing audits explained per run. Fourteen covers a genuinely bad page without
   *  turning the response into a wall the reader skims past. */
  private static readonly AUDIT_LIMIT = 14;

  /**
   * One or two sentences to go out with an alert.
   *
   * Time-boxed: an alert that is late is nearly as bad as one that never arrives, so the
   * note is whatever the model managed inside the deadline, or nothing.
   */
  static async getAlertNote(
    alert: { kind: string; url: string; formFactor: string | null; lines: string[] },
    opts: { timeoutMs?: number } = {},
  ): Promise<string | null> {
    const prompt = `You are a web performance expert. A monitoring alert just fired.

${VOICE}

In at most 2 sentences: what this likely means for the people using the page, and the first thing to check.

Alert: ${alert.kind}
Page: ${alert.url} (${alert.formFactor ?? 'desktop'})
Findings:
${alert.lines.map(l => `- ${l}`).join('\n')}`;

    const text = (await this.generate(prompt, opts)).trim();
    return text || null;
  }

  /** The editor's note at the top of the weekly digest. */
  static async getDigestSummary(data: {
    sites: number; audits: number; avgScore: number | null; prevAvgScore: number | null;
    regressions: number; breaches: number;
    slowest: Array<{ url: string; score: number; lcp: number }>;
  }): Promise<string | null> {
    const prompt = `You are a web performance expert writing the opening note of a weekly report.

${VOICE}

At most 3 sentences: the biggest movement this week and the one page most worth fixing next.

Sites: ${data.sites}, audits run: ${data.audits}
Average score: ${data.avgScore ?? 'n/a'} (previous week: ${data.prevAvgScore ?? 'n/a'})
Regressions: ${data.regressions}, targets missed: ${data.breaches}
Slowest pages:
${data.slowest.map(r => `- ${r.url} score ${r.score} lcp ${Math.round(r.lcp)}ms`).join('\n') || '- (none)'}`;

    const text = (await this.generate(prompt)).trim();
    return text || null;
  }


  /**
   * The advisor's answer to "what should I do next?".
   *
   * Structured rather than prose because this drives a panel that is on screen all the
   * time: a headline short enough to read at a glance, and up to three concrete steps.
   * Anything longer becomes wallpaper — the whole point is that it is worth reading.
   */
  static async getAdvice(input: {
    /** What the user is looking at, so the advice is about that and not the whole account. */
    scope: string;
    /** Pre-formatted lines of context. The caller decides what is worth showing. */
    lines: string[];
    /** URLs the model is allowed to attach an action to. Anything else is dropped. */
    knownUrls: string[];
  }): Promise<AiAdvice | null> {
    if (input.lines.length === 0) return null;

    const prompt = `You are a web performance advisor embedded in a monitoring tool. The user is looking at: ${input.scope}.

${VOICE}

Answer ONLY with JSON: {"headline": string, "steps": [{"title": string, "detail": string, "action": {"kind": string, "url": string} | null}]}

- headline: at most 12 words, the single most useful thing to say right now.
- steps: 1 to 3, ordered by what to do first. title at most 8 words, detail at most 25 words and concrete.
- If everything looks healthy, say so plainly and suggest what to watch, rather than inventing problems.
- Refer to specific sites and numbers from the context. Never repeat a number without interpreting it.
- If the context describes something the user did as a direct result of past advice (an action they took and what happened after), that is the news — lead the headline with it, plainly saying whether it helped, using the exact numbers given. Do not invent this if the context does not mention it.
- If the context includes a trend toward a target, you may work the pace into a step (how it's moving, roughly how long at that rate) — but only using the numbers given, never a projection you calculated yourself.
- action: include it ONLY when the step is one of these four things this tool can do, and ONLY with a url from the list below. Otherwise use null — most advice is work done outside this tool.
    "audit"    run an audit of that page now
    "schedule" set up recurring audits for it
    "compare"  measure it against a competitor
    "budgets"  set up where breach alerts are sent (webhook or email)
  Urls you may use: ${input.knownUrls.join(', ') || '(none)'}

Context:
${input.lines.join('\n')}`;

    const raw = await this.generate(prompt);
    const parsed = this.parseJson<{ headline?: unknown; steps?: unknown }>(raw, 'advice');
    if (!parsed || typeof parsed.headline !== 'string' || !parsed.headline.trim()) return null;

    const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
    const allowed = new Set(input.knownUrls);

    return {
      headline: parsed.headline.trim().slice(0, 140),
      steps: steps
        .filter((s): s is { title: string; detail: string; action?: unknown } =>
          !!s && typeof (s as { title?: unknown }).title === 'string'
              && typeof (s as { detail?: unknown }).detail === 'string')
        .slice(0, 3)
        .map(s => {
          const action = this.parseAction(s.action, allowed);
          return {
            title:  s.title.trim().slice(0, 80),
            detail: s.detail.trim().slice(0, 220),
            ...(action ? { action } : {}),
          };
        }),
    };
  }

  /**
   * An action, or nothing.
   *
   * Both halves are checked against a closed set: the kind against what the app can
   * actually do, and the url against sites the user really has. A model that invents a
   * plausible-looking url would otherwise produce a button that goes somewhere wrong,
   * which is worse than a step with no button at all.
   */
  private static parseAction(raw: unknown, allowed: Set<string>): AiAdviceAction | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const { kind, url } = raw as { kind?: unknown; url?: unknown };

    const KINDS = ['audit', 'schedule', 'compare', 'budgets'] as const;
    if (typeof kind !== 'string' || !KINDS.includes(kind as (typeof KINDS)[number])) return undefined;
    if (typeof url !== 'string' || !allowed.has(url)) return undefined;

    return { kind: kind as AiAdviceAction['kind'], url };
  }

  /** The verdict on a saved head-to-head comparison. */
  static async getCompareVerdict(entry: {
    sourceUrl: string; targetUrl: string;
    source:     { scores: Record<string, number>; metrics: Record<string, number> };
    competitor: { scores: Record<string, number>; metrics: Record<string, number> };
  }): Promise<string | null> {
    const side = (s: { scores: Record<string, number>; metrics: Record<string, number> }) =>
      `perf ${s.scores['performance'] ?? '?'} lcp ${Math.round(s.metrics['lcp'] ?? 0)}ms tbt ${Math.round(s.metrics['tbt'] ?? 0)}ms cls ${s.metrics['cls'] ?? 0}`;

    const prompt = `You are a web performance expert. Two sites were just measured head to head.

${VOICE}

In 2-3 sentences: who is faster overall, the single biggest gap, and the one metric the slower site should attack first.

Yours (${entry.sourceUrl}): ${side(entry.source)}
Rival (${entry.targetUrl}): ${side(entry.competitor)}`;

    const text = (await this.generate(prompt)).trim();
    return text || null;
  }
}
