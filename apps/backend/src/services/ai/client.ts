/**
 * The Gemini transport — model selection, prompt cache, fence-stripping, deadline,
 * JSON parsing. Everything else in services/ai/ is a consumer of `generate()`; no other
 * file may talk to the SDK.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
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
 */
const MODEL = 'gemini-flash-lite-latest';

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

interface UsageTally { calls: number; cacheHits: number; inTokens: number; outTokens: number }

/** Running per-label totals since process start. In memory on purpose: this answers
 *  "what does each prompt cost and how often does the cache save us", which is a
 *  capacity/model-tier question, not billing — nothing here needs to survive a restart. */
const usageTotals = new Map<string, UsageTally>();

function tallyFor(label: string): UsageTally {
  let t = usageTotals.get(label);
  if (!t) { t = { calls: 0, cacheHits: 0, inTokens: 0, outTokens: 0 }; usageTotals.set(label, t); }
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
  // The SDK's own `timeout` option aborts the underlying fetch; a `Promise.race` around an
  // un-cancelled call only abandons the wait while the request keeps running server-side.
  const requestOptions = opts.timeoutMs === undefined ? undefined : { timeout: opts.timeoutMs };
  const result = await model.generateContent(
    opts.json
      ? {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }
      : prompt,
    requestOptions,
  );
  const raw = result.response.text();

  const usage = result.response.usageMetadata;
  if (usage) {
    const t = tallyFor(label);
    t.calls    += 1;
    t.inTokens += usage.promptTokenCount;
    t.outTokens += usage.candidatesTokenCount;
    console.log(
      `[AI] usage ${label}: ${fmtK(usage.promptTokenCount)} in / ${fmtK(usage.candidatesTokenCount)} out` +
      ` (total ${t.calls} calls + ${t.cacheHits} cached, ${fmtK(t.inTokens)} in / ${fmtK(t.outTokens)} out)`,
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
