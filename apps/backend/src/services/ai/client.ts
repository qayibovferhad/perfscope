/**
 * The Gemini transport — model selection, prompt cache, fence-stripping, deadline,
 * JSON parsing. Everything else in services/ai/ is a consumer of `generate()`; no other
 * file may talk to the SDK.
 */
import { GoogleGenerativeAI, type GenerateContentResult } from '@google/generative-ai';
import { createHash } from 'node:crypto';
import { config } from '../../config/index.js';

/** Identical prompt in, identical text out — so retries and re-saves cost nothing. */
const CACHE_TTL_MS = 6 * 60 * 60_000;
const CACHE_MAX    = 300;

/**
 * Bounds the calls a person is actually waiting behind (analyzer diagnosis, the advisor,
 * an asked question) so a hung Gemini request can't leave a skeleton up forever — measured
 * once at ~10 minutes with no timeout at all. NOT a tight SLA: `analysePage`'s own heaviest
 * measured fixture (15 failing audits, full details + resource diff + cross-page vendors)
 * took 22.5s legitimately — a tighter bound killed that real, successful answer as if it
 * were a hang. This only needs to catch an actual stall, so it stays well above real latency.
 */
export const DEEP_CALL_TIMEOUT_MS = 45_000;

/**
 * Gemini answers 503 "this model is currently experiencing high demand" under load —
 * measured, twice in a row on `gemini-flash-latest` while comparing model tiers. Without
 * a retry that response is lost *permanently*, not just for this request: AI is generated
 * at write time and stored on the audit, so nothing ever asks again and the audit keeps a
 * hole where its diagnosis should be.
 *
 * One extra attempt, not a backoff ladder. A second 503 means the tier is genuinely
 * saturated, and the callers that matter have a person waiting behind them.
 */
const MAX_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 1_500;
/** A retry that cannot plausibly finish inside what is left of the deadline is not started. */
const MIN_RETRY_BUDGET_MS = 5_000;

/** Overload and transport failures only. 400/403/404 are the key, the quota or a retired
 *  model alias — all of which answer identically the second time. */
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const NETWORK_ERROR = /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i;

function isTransient(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === 'number') return RETRY_STATUSES.has(status);
  return NETWORK_ERROR.test(String((err as { message?: unknown } | null)?.message ?? ''));
}

function describeError(err: unknown): string {
  // The SDK's message opens with its own name and the full endpoint URL, which pushes the
  // one useful part — Google's reason — past any sane log width. Drop the preamble.
  const message = String((err as { message?: unknown } | null)?.message ?? err)
    .replace(/^.*?Error fetching from \S+?: /, '');
  return message.slice(0, 100);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * How every prompt in services/ai/ is told to write.
 *
 * Six prompts grew independently and ended up in six registers — a numbered command list,
 * subjectless fragments ("Delayed by heavy script execution"), flowing prose, semicolon
 * instructions — so the product read as six tools rather than one assistant. This is the
 * single answer to "what does PerfScope sound like".
 */
export const VOICE = `Write as one consistent assistant:
- Address the reader as "you" and their site as "your". Plain sentences, no markdown, no numbered lists, no headings.
- Durations in seconds above 1000ms ("3.79s"), otherwise milliseconds ("240ms"). Never write a raw millisecond figure like "3787 milliseconds".
- Never restate what a metric or an audit means. Say what it means for THIS page.
- One idea per sentence. No filler, no "consider", no "it is recommended".`;

/**
 * Google's rolling alias, not a pinned version. `gemini-2.0-flash-lite` was retired and
 * every audit logged a 404 for weeks with nobody noticing; when this was fixed,
 * `gemini-2.5-flash-lite` was *listed* by the models endpoint and already 404ing too.
 * The alias moves with them. If Google ever drops it, ListModels is the place to look.
 *
 * `GEMINI_MODEL` overrides it, which is how the tier comparison runs the same fixture
 * through several models without touching code.
 */
const MODEL = config.geminiModel;

/** The model in use — printed by probes so a measurement is never anonymous. */
export function activeModel(): string { return MODEL; }

export function isAiAvailable(): boolean {
  return !!config.geminiApiKey;
}

function getModel() {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY is not configured');
  const client = new GoogleGenerativeAI(config.geminiApiKey);
  return client.getGenerativeModel({ model: MODEL });
}

const cache = new Map<string, { text: string; expiresAt: number }>();

// ─── Usage telemetry ──────────────────────────────────────────────────────────

interface UsageTally {
  calls: number; cacheHits: number; inTokens: number; outTokens: number;
  /** Transient failures that a second attempt recovered, and calls that ran out of attempts.
   *  This is the only record that a prompt is failing: the callers log one line and move on
   *  with a null, so without a count a model under sustained load looks like silence. */
  retries: number; failures: number;
}

/** Running per-label totals since process start. In memory on purpose: this answers
 *  "what does each prompt cost and how often does the cache save us", which is a
 *  capacity/model-tier question, not billing — nothing here needs to survive a restart. */
const usageTotals = new Map<string, UsageTally>();

function tallyFor(label: string): UsageTally {
  let t = usageTotals.get(label);
  if (!t) { t = { calls: 0, cacheHits: 0, inTokens: 0, outTokens: 0, retries: 0, failures: 0 }; usageTotals.set(label, t); }
  return t;
}

const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

/** Per-label usage so far — for probes and any future admin surface. */
export function aiUsageSnapshot(): Record<string, UsageTally> {
  return Object.fromEntries([...usageTotals].map(([k, v]) => [k, { ...v }]));
}

export interface GenerateOptions {
  timeoutMs?: number;
  /**
   * Ask Gemini for `application/json` output. The instruction "Answer ONLY with JSON"
   * still lives in each prompt (it shapes *what* JSON), but with this set the decoder
   * itself is constrained — no fences, no prose around the object, so `parseJson`
   * downstream becomes a type check rather than a gamble on the model's discipline.
   */
  json?: boolean;
  /** Telemetry label ("page analysis", "advice", …); token usage is tallied per label. */
  label?: string;
}

/**
 * The single door to Gemini. Every prompt goes through here so the fence-stripping,
 * the cache, the deadline and the usage tally are written once rather than per method.
 *
 * `timeoutMs` matters for the callers a person is waiting behind — an alert must go out
 * whether or not the model has anything to say about it.
 */
export async function generate(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const label = opts.label ?? 'unlabelled';
  // The mode is part of the identity: the same prompt answers differently in JSON mode.
  const key = createHash('sha256')
    .update(MODEL).update('\0')
    .update(opts.json ? 'json' : 'text').update('\0')
    .update(prompt).digest('hex');
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    tallyFor(label).cacheHits += 1;
    return hit.text;
  }

  const model = getModel();
  const request = opts.json
    ? {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }
    : prompt;

  // One deadline for the whole call, not one per attempt: `timeoutMs` is how long a person
  // waits, and a retry granted its own fresh 45s would double exactly the thing it bounds.
  // The SDK's `timeout` aborts the underlying fetch; a `Promise.race` around an un-cancelled
  // call only abandons the wait while the request keeps running server-side.
  const deadline = opts.timeoutMs === undefined ? undefined : Date.now() + opts.timeoutMs;

  let result: GenerateContentResult;
  for (let attempt = 1; ; attempt++) {
    const remaining = deadline === undefined ? undefined : deadline - Date.now();
    try {
      result = await model.generateContent(request, remaining === undefined ? undefined : { timeout: remaining });
      break;
    } catch (err) {
      const budgetLeft = deadline === undefined
        || deadline - Date.now() > RETRY_BACKOFF_MS + MIN_RETRY_BUDGET_MS;
      if (attempt >= MAX_ATTEMPTS || !isTransient(err) || !budgetLeft) {
        tallyFor(label).failures += 1;
        throw err;
      }
      tallyFor(label).retries += 1;
      console.warn(`[AI] ${label}: ${describeError(err)} — retrying once in ${RETRY_BACKOFF_MS}ms`);
      await sleep(RETRY_BACKOFF_MS);
    }
  }
  const raw = result.response.text();

  const usage = result.response.usageMetadata;
  if (usage) {
    const t = tallyFor(label);
    t.calls    += 1;
    t.inTokens += usage.promptTokenCount;
    t.outTokens += usage.candidatesTokenCount;
    console.log(
      `[AI] usage ${label}: ${fmtK(usage.promptTokenCount)} in / ${fmtK(usage.candidatesTokenCount)} out` +
      ` (total ${t.calls} calls + ${t.cacheHits} cached, ${fmtK(t.inTokens)} in / ${fmtK(t.outTokens)} out` +
      `${t.retries || t.failures ? `, ${t.retries} retried / ${t.failures} failed` : ''})`,
    );
  }

  // Models fence JSON even when told not to; strip it once, here, for everyone.
  const text = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  // An empty answer is not an answer worth remembering. Caching one would turn a single
  // blank or refused response into six hours of silence for that exact prompt, and every
  // caller treats empty as "nothing to say" rather than "ask again".
  if (!text) return text;

  if (cache.size >= CACHE_MAX) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.expiresAt <= now) cache.delete(k);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  }
  cache.set(key, { text, expiresAt: Date.now() + CACHE_TTL_MS });
  return text;
}

/** Parse a fenced-or-bare JSON reply; `null` rather than a throw when the model rambles. */
export function parseJson<T>(text: string, label: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error(`[AI] Failed to parse ${label} JSON:`, text.slice(0, 200));
    return null;
  }
}
