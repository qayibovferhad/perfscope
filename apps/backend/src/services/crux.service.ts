import { config } from '../config/index.js';
import { postJson } from '../lib/http.js';
import type { AuditFormFactor, CruxData, CruxMetric, CruxMetricKey } from '@perfscope/shared';

/**
 * Chrome UX Report (CrUX) — real-user FIELD data to sit next to Lighthouse's LAB numbers.
 *
 * Disabled cleanly when CRUX_API_KEY is unset (same contract as GEMINI_API_KEY /
 * SMTP_HOST): warn once, return null, never throw.
 *
 * Docs: https://developer.chrome.com/docs/crux/api
 */

const ENDPOINT    = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';
const REQUEST_TIMEOUT_MS = 10_000;
/** CrUX aggregates over a trailing 28-day window and refreshes daily — 6h is plenty fresh. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const FORM_FACTOR: Record<AuditFormFactor, 'PHONE' | 'DESKTOP'> = {
  mobile:  'PHONE',
  desktop: 'DESKTOP',
};

/** CrUX metric id → our compact key. Anything else in the record is ignored. */
const METRIC_KEYS: Record<string, CruxMetricKey> = {
  largest_contentful_paint:        'lcp',
  interaction_to_next_paint:       'inp',
  cumulative_layout_shift:         'cls',
  first_contentful_paint:          'fcp',
  experimental_time_to_first_byte: 'ttfb',
};

// ─── Raw API shapes (only the fields we read) ────────────────────────────────

interface RawBin { start?: number | string; end?: number | string; density?: number }
interface RawMetric {
  histogram?:   RawBin[];
  percentiles?: { p75?: number | string };
}
interface RawDate { year?: number; month?: number; day?: number }
export interface CruxRecord {
  key?:     { url?: string; origin?: string; formFactor?: string };
  metrics?: Record<string, RawMetric>;
  collectionPeriod?: { firstDate?: RawDate; lastDate?: RawDate };
}
interface RawResponse { record?: CruxRecord }

// ─── Mapping ─────────────────────────────────────────────────────────────────

/** CLS percentiles arrive as strings ("0.05"); everything else as numbers. */
function toNumber(value: number | string | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** The API always returns exactly three bins, ordered good → needs-improvement → poor. */
function toMetric(raw: RawMetric): CruxMetric | null {
  const p75 = toNumber(raw.percentiles?.p75);
  if (p75 === null) return null;

  const bins = raw.histogram ?? [];
  return {
    p75,
    good:             toNumber(bins[0]?.density) ?? 0,
    needsImprovement: toNumber(bins[1]?.density) ?? 0,
    poor:             toNumber(bins[2]?.density) ?? 0,
  };
}

function fmtDate(date: RawDate | undefined): string {
  if (!date?.year || !date.month || !date.day) return '';
  const mm = String(date.month).padStart(2, '0');
  const dd = String(date.day).padStart(2, '0');
  return `${date.year}-${mm}-${dd}`;
}

/**
 * Maps a raw CrUX record onto our CruxData contract. Exported so the mapping can be
 * exercised against a captured API response without a live key.
 */
export function mapCruxRecord(
  record:     CruxRecord,
  url:        string,
  formFactor: AuditFormFactor,
  scope:      'url' | 'origin',
): CruxData {
  const metrics: Partial<Record<CruxMetricKey, CruxMetric>> = {};

  for (const [rawKey, raw] of Object.entries(record.metrics ?? {})) {
    const key = METRIC_KEYS[rawKey];
    if (!key) continue;
    const metric = toMetric(raw);
    if (metric) metrics[key] = metric;
  }

  return {
    scope,
    url:           record.key?.url ?? record.key?.origin ?? url,
    formFactor,
    collectedFrom: fmtDate(record.collectionPeriod?.firstDate),
    collectedTo:   fmtDate(record.collectionPeriod?.lastDate),
    metrics,
  };
}

// ─── Fetching ────────────────────────────────────────────────────────────────

type QueryOutcome =
  | { status: 'ok'; record: CruxRecord }
  /** CrUX has no sample for this key — the caller decides whether to widen the scope. */
  | { status: 'no-data' }
  | { status: 'error' };

async function queryRecord(
  body: Record<string, string>,
  apiKey: string,
): Promise<QueryOutcome> {
  try {
    const res = await postJson(
      `${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, body, { timeoutMs: REQUEST_TIMEOUT_MS },
    );

    if (res.status === 404) return { status: 'no-data' };
    if (!res.ok) {
      console.error(`[CrUX] API responded ${res.status} for ${body['url'] ?? body['origin']}`);
      return { status: 'error' };
    }

    const json = (await res.json()) as RawResponse;
    if (!json.record) return { status: 'no-data' };
    return { status: 'ok', record: json.record };
  } catch (err) {
    console.error('[CrUX] request failed', err);
    return { status: 'error' };
  }
}

// ─── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry { data: CruxData; expiresAt: number }
const cache = new Map<string, CacheEntry>();

const cacheKey = (url: string, formFactor: AuditFormFactor): string => `${formFactor}|${url}`;

let warnedDisabled = false;

// ─── Public API ──────────────────────────────────────────────────────────────

export const CruxService = {
  /**
   * Field data for a page: URL-level when CrUX has enough samples for that exact
   * page, otherwise the whole origin. Returns null when the key is missing, the
   * request fails, or CrUX simply has no data for the site.
   */
  async get(url: string, formFactor: AuditFormFactor): Promise<CruxData | null> {
    const apiKey = config.cruxApiKey;
    if (!apiKey) {
      if (!warnedDisabled) {
        console.warn('[CrUX] CRUX_API_KEY not set — real-user field data disabled');
        warnedDisabled = true;
      }
      return null;
    }

    const key    = cacheKey(url, formFactor);
    const cached = cache.get(key);
    if (cached) {
      if (cached.expiresAt > Date.now()) return cached.data;
      cache.delete(key);
    }

    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      console.error(`[CrUX] invalid url: ${url}`);
      return null;
    }

    const apiFormFactor = FORM_FACTOR[formFactor];

    // URL-level first — the page's own numbers are what an audit is about.
    const byUrl = await queryRecord({ url, formFactor: apiFormFactor }, apiKey);
    if (byUrl.status === 'error') return null;

    let data: CruxData;
    if (byUrl.status === 'ok') {
      data = mapCruxRecord(byUrl.record, url, formFactor, 'url');
    } else {
      // Most pages are below CrUX's reporting threshold; the origin usually is not.
      const byOrigin = await queryRecord({ origin, formFactor: apiFormFactor }, apiKey);
      if (byOrigin.status !== 'ok') return null;
      data = mapCruxRecord(byOrigin.record, origin, formFactor, 'origin');
    }

    if (Object.keys(data.metrics).length === 0) return null;

    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  },
};
