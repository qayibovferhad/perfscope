import type { Result as LhrResult } from 'lighthouse';
import type {
  NetworkRequest,
  ResourceType,
  ResourceTypeSummary,
  ResourceSummary,
  DetectedLibrary,
  ParsedResources,
} from '../types/index.js';

// ─── Library Detection Patterns ──────────────────────────────────────────────
// Each entry: [libraryName, regex tested against the full URL]

const LIBRARY_PATTERNS: Array<[string, RegExp]> = [
  // Frameworks
  ['react',          /\breact(?:[-.]dom)?(?:\.development|\.production\.min)?\.js/i],
  ['vue',            /\bvue(?:@[\d.]+)?(?:\.runtime)?(?:\.esm)?(?:\.min)?\.js/i],
  ['angular',        /\bangular(?:\.min)?\.js/i],
  ['svelte',         /\bsvelte(?:\.min)?\.js/i],
  ['ember',          /\bember(?:\.min)?\.js/i],
  ['backbone',       /\bbackbone(?:\.min)?\.js/i],
  ['preact',         /\bpreact(?:\.min)?\.js/i],
  ['solid',          /\bsolid-js/i],

  // Meta-frameworks (CDN paths)
  ['next.js',        /\/_next\/static\//i],
  ['nuxt',           /\/_nuxt\//i],
  ['gatsby',         /\/gatsby(?:-browser|-ssr)?(?:\.min)?\.js/i],
  ['remix',          /\/build\/(?:root|entry)\./i],

  // Utility libraries
  ['lodash',         /\blodash(?:\.min)?\.js/i],
  ['underscore',     /\bunderscore(?:\.min)?\.js/i],
  ['ramda',          /\bramda(?:\.min)?\.js/i],
  ['date-fns',       /\bdate-fns/i],
  ['moment',         /\bmoment(?:\.min)?\.js/i],
  ['dayjs',          /\bdayjs(?:\.min)?\.js/i],
  ['luxon',          /\bluxon(?:\.min)?\.js/i],

  // HTTP / async
  ['axios',          /\baxios(?:\.min)?\.js/i],
  ['ky',             /\bky(?:\.min)?\.js/i],

  // State management
  ['redux',          /\bredux(?:\.min)?\.js/i],
  ['zustand',        /\bzustand/i],
  ['mobx',           /\bmobx(?:\.min)?\.js/i],
  ['recoil',         /\brecoil(?:\.min)?\.js/i],
  ['jotai',          /\bjotai/i],

  // UI / component libraries
  ['jquery',         /\bjquery(?:-\d[\d.]*)?(?:\.min)?\.js/i],
  ['bootstrap',      /\bbootstrap(?:\.bundle)?(?:\.min)?\.(?:js|css)/i],
  ['tailwind',       /\btailwind(?:css)?(?:\.min)?\.css/i],
  ['material-ui',    /\@material-ui|mui\/material/i],
  ['ant-design',     /antd(?:\.min)?\.(?:js|css)/i],
  ['chakra-ui',      /\@chakra-ui/i],
  ['shadcn',         /\bshadcn/i],
  ['radix',          /\@radix-ui/i],

  // Animation
  ['framer-motion',  /\bframer-motion/i],
  ['gsap',           /\bgsap(?:\.min)?\.js/i],
  ['anime',          /\banime(?:\.min)?\.js/i],
  ['three.js',       /\bthree(?:\.min)?\.js/i],

  // Data viz
  ['d3',             /\bd3(?:\.min)?\.js/i],
  ['chart.js',       /\bchart(?:\.min)?\.js/i],
  ['echarts',        /\becharts(?:\.min)?\.js/i],
  ['highcharts',     /\bhighcharts(?:\.min)?\.js/i],
  ['recharts',       /\brecharts/i],

  // Build tools (bundles)
  ['webpack',        /\/webpack(?:[-.]runtime)?\.js/i],
  ['vite',           /\/@vite\//i],

  // Analytics / tracking
  ['google-analytics', /google-analytics\.com\/(?:analytics|gtag)\.js/i],
  ['gtag',           /googletagmanager\.com/i],
  ['hotjar',         /hotjar(?:\.com|\.js)/i],
  ['segment',        /cdn\.segment\.com/i],
  ['mixpanel',       /mixpanel(?:\.min)?\.js/i],
  ['amplitude',      /amplitude(?:\.min)?\.js/i],
  ['sentry',         /\@sentry|sentry(?:\.min)?\.js/i],

  // CDN-based detection (cloudflare cdnjs path pattern)
  ['cdnjs',          /cdnjs\.cloudflare\.com\/ajax\/libs\/([^/]+)\//i],
];

// ─── Critical Thresholds ──────────────────────────────────────────────────────

const CRITICAL_THRESHOLDS: Partial<Record<ResourceType, number>> = {
  script:     500  * 1024,   // 500 KB
  image:      1024 * 1024,   // 1 MB
  media:      5    * 1024 * 1024, // 5 MB
  font:       200  * 1024,   // 200 KB
};

function checkCritical(resourceType: ResourceType, transferSize: number): boolean {
  const threshold = CRITICAL_THRESHOLDS[resourceType];
  return threshold !== undefined && transferSize > threshold;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectLibrary(url: string): string | null {
  for (const [name, pattern] of LIBRARY_PATTERNS) {
    if (pattern.test(url)) return name;
  }
  return null;
}

function isThirdParty(requestUrl: string, pageOrigin: string): boolean {
  try {
    const reqHost = new URL(requestUrl).hostname;
    const pageHost = new URL(pageOrigin).hostname;
    // Strip leading "www." for comparison
    const normalize = (h: string) => h.replace(/^www\./, '');
    return normalize(reqHost) !== normalize(pageHost);
  } catch {
    return false;
  }
}

const RESOURCE_TYPE_MAP: Record<string, ResourceType> = {
  script:     'script',
  stylesheet: 'stylesheet',
  image:      'image',
  font:       'font',
  document:   'document',
  media:      'media',
  xmlhttprequest: 'other',
  fetch:      'other',
  websocket:  'other',
  other:      'other',
};

function normalizeResourceType(raw: string): ResourceType {
  return RESOURCE_TYPE_MAP[raw.toLowerCase()] ?? 'other';
}

function emptyTypeSummary(): ResourceTypeSummary {
  return { requestCount: 0, transferSize: 0, resourceSize: 0 };
}

function emptyResourceSummary(): ResourceSummary {
  return {
    script:     emptyTypeSummary(),
    stylesheet: emptyTypeSummary(),
    image:      emptyTypeSummary(),
    font:       emptyTypeSummary(),
    document:   emptyTypeSummary(),
    media:      emptyTypeSummary(),
    other:      emptyTypeSummary(),
    total:      emptyTypeSummary(),
  };
}

// ─── LHR Audit Item shapes (Lighthouse details are loosely typed) ─────────────

interface LhrNetworkItem {
  url?: string;
  resourceType?: string;
  transferSize?: number;
  resourceSize?: number;
  statusCode?: number;
  mimeType?: string;
}

interface LhrSummaryItem {
  resourceType?: string;
  requestCount?: number;
  transferSize?: number;
  size?: number;          // resourceSize in older LH versions
  resourceSize?: number;
}

interface LhrTableDetails {
  type: string;
  items: unknown[];
}

function getTableItems<T>(lhr: LhrResult, auditId: string): T[] {
  const audit = lhr.audits[auditId];
  if (!audit?.details) return [];
  const details = audit.details as LhrTableDetails;
  if (details.type !== 'table' || !Array.isArray(details.items)) return [];
  return details.items as T[];
}

// ─── Main Parser ─────────────────────────────────────────────────────────────

export function parseResources(lhr: LhrResult, pageUrl: string): ParsedResources {
  const networkItems = getTableItems<LhrNetworkItem>(lhr, 'network-requests');
  const summaryItems = getTableItems<LhrSummaryItem>(lhr, 'resource-summary');

  // ── Parse network requests ──────────────────────────────────────────────
  const requests: NetworkRequest[] = networkItems
    .filter((item) => Boolean(item.url))
    .map((item): NetworkRequest => {
      const url = item.url!;
      const resourceType = normalizeResourceType(item.resourceType ?? 'other');
      const transferSize = item.transferSize ?? 0;
      return {
        url,
        resourceType,
        transferSize,
        resourceSize:    item.resourceSize    ?? 0,
        statusCode:      item.statusCode      ?? 0,
        mimeType:        item.mimeType        ?? '',
        isThirdParty:    isThirdParty(url, pageUrl),
        detectedLibrary: detectLibrary(url),
        isCritical:      checkCritical(resourceType, transferSize),
      };
    });

  // ── Build summary from resource-summary audit (prefer LH's own aggregates) ─
  const summary = emptyResourceSummary();

  if (summaryItems.length > 0) {
    for (const item of summaryItems) {
      // LH resource-summary includes a 'total' row — skip it, we recompute below
      if ((item.resourceType ?? '').toLowerCase() === 'total') continue;
      const type = normalizeResourceType(item.resourceType ?? 'other');
      const bucket = summary[type] ?? summary.other;

      bucket.requestCount  += item.requestCount  ?? 0;
      bucket.transferSize  += item.transferSize  ?? 0;
      bucket.resourceSize  += (item.resourceSize ?? item.size ?? 0);
    }
  } else {
    // Fallback: aggregate from network requests
    for (const req of requests) {
      const bucket = summary[req.resourceType];
      bucket.requestCount++;
      bucket.transferSize  += req.transferSize;
      bucket.resourceSize  += req.resourceSize;
    }
  }

  // Always recompute total from buckets for consistency
  summary.total = (
    ['script', 'stylesheet', 'image', 'font', 'document', 'media', 'other'] as ResourceType[]
  ).reduce<ResourceTypeSummary>(
    (acc, key) => ({
      requestCount: acc.requestCount + summary[key].requestCount,
      transferSize: acc.transferSize + summary[key].transferSize,
      resourceSize: acc.resourceSize + summary[key].resourceSize,
    }),
    emptyTypeSummary(),
  );

  // ── Derived views ────────────────────────────────────────────────────────
  const thirdPartyRequests = requests.filter((r) => r.isThirdParty);
  const jsFiles = requests.filter((r) => r.resourceType === 'script');

  // Deduplicate detected libraries, keep the largest transfer size per name
  const libraryMap = new Map<string, DetectedLibrary>();
  for (const req of requests) {
    if (!req.detectedLibrary) continue;
    const existing = libraryMap.get(req.detectedLibrary);
    if (!existing || req.transferSize > existing.transferSize) {
      libraryMap.set(req.detectedLibrary, {
        name:         req.detectedLibrary,
        url:          req.url,
        transferSize: req.transferSize,
        isThirdParty: req.isThirdParty,
        isCritical:   req.isCritical,
      });
    }
  }
  const detectedLibraries = Array.from(libraryMap.values()).sort(
    (a, b) => b.transferSize - a.transferSize,
  );

  return { requests, summary, thirdPartyRequests, jsFiles, detectedLibraries };
}
