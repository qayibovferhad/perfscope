/**
 * The routes a site says it has.
 *
 * Automation is per route, and every route had to be typed in by hand — which meant most
 * schedules audited the home page and nothing else, not because the rest of the site does
 * not matter but because listing it was tedious. Nearly every site already publishes the
 * list: `sitemap.xml`, or a pointer to it in `robots.txt`.
 *
 * Parsed with a regular expression rather than an XML library. The grammar in play is
 * `<loc>` inside `<url>` or `<sitemap>`, optionally with `<priority>` and `<lastmod>`, and a
 * dependency that can parse arbitrary XML — including entities and external references —
 * is a larger surface than the thing it would buy.
 */
import { hostOf } from '../lib/url.js';
import { isFetchableTarget } from '../lib/ssrf.js';

export interface DiscoveredRoute {
  /** Path with its query string, as the sitemap gives it: `/pricing`, `/blog/post-1`. */
  path:      string;
  /** 0–1, when the sitemap says. Sites that set it are telling us what matters to them. */
  priority?: number;
  lastmod?:  string;
}

export interface RouteDiscovery {
  routes: DiscoveredRoute[];
  /** Which sitemaps answered — shown to the user, because "we found nothing" and "there is
   *  no sitemap" are different answers and only one of them is their problem. */
  sources: string[];
  /** Set when nothing could be read at all. */
  reason?: string;
}

/** One page of a sitemap can list 50,000 URLs; nobody schedules 50,000 audits. */
const MAX_ROUTES = 100;
/** A sitemap index points at more sitemaps. Follow a few, not a tree. */
const MAX_NESTED = 5;
/** Big enough for a real sitemap, small enough that a hostile one cannot exhaust memory. */
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 8_000;

/** Paths that are never worth auditing as a page. */
const SKIP = /\.(xml|txt|json|rss|atom|jpe?g|png|gif|svg|webp|avif|ico|css|js|mjs|pdf|zip|mp4|webm|woff2?)$/i;

/**
 * Whether a 200 response is actually a sitemap.
 *
 * A single-page app routes everything through one HTML document, so `/sitemap.xml` answers
 * 200 with the application shell — and a status code alone would have this reporting "we
 * read your sitemap and found no pages in it", which is both wrong and unactionable. The
 * honest answer for those sites is that there is no sitemap.
 */
const looksLikeSitemap = (body: string) => /<urlset\b|<sitemapindex\b|<loc>/i.test(body);

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'PerfScope/1.0 (+route discovery)' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
  } catch {
    return null;
  }
}

/** `<loc>` values, with the `<priority>`/`<lastmod>` that share their entry. */
function parseEntries(xml: string): { loc: string; priority?: number; lastmod?: string }[] {
  const out: { loc: string; priority?: number; lastmod?: string }[] = [];
  // Each <url>…</url> or <sitemap>…</sitemap> block, so a priority belongs to its own loc
  // rather than to whichever came last in the file.
  for (const block of xml.match(/<(?:url|sitemap)\b[\s\S]*?<\/(?:url|sitemap)>/gi) ?? []) {
    const loc = block.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i)?.[1];
    if (!loc) continue;
    const priority = Number(block.match(/<priority>\s*([\d.]+)\s*<\/priority>/i)?.[1]);
    const lastmod = block.match(/<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/i)?.[1];
    out.push({
      loc: decodeXml(loc),
      ...(Number.isFinite(priority) ? { priority } : {}),
      ...(lastmod ? { lastmod } : {}),
    });
  }

  // A sitemap with bare <loc> tags and no wrapper still parses — some generators emit them.
  if (out.length === 0) {
    for (const m of xml.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)) {
      if (m[1]) out.push({ loc: decodeXml(m[1]) });
    }
  }
  return out;
}

/** The five entities XML defines. A sitemap URL with an `&` in it arrives as `&amp;`. */
function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Sitemap URLs named by robots.txt — the standard place to put one that is not at the root. */
function sitemapsFromRobots(robots: string): string[] {
  return [...robots.matchAll(/^\s*sitemap:\s*(\S+)\s*$/gim)].map(m => m[1]!).slice(0, MAX_NESTED);
}

/**
 * Discover the routes of a site the caller owns.
 *
 * Only ever fetches the site's own origin (and sitemaps it names), and only over http(s):
 * the URL comes from the caller's own `Website` record, but "it was in our database" is not
 * a reason to follow a `file://` or a redirect to somewhere else's network.
 */
export async function discoverRoutes(siteUrl: string): Promise<RouteDiscovery> {
  let origin: string;
  let host: string;
  try {
    const u = new URL(siteUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { routes: [], sources: [], reason: 'Only http and https sites can be scanned.' };
    origin = u.origin;
    host = u.host;
  } catch {
    return { routes: [], sources: [], reason: 'That site has no usable URL.' };
  }

  // The URL comes from the caller's own Website record, but "it is in our database" is not
  // a reason to fetch an address on this server's own network. No-op in development, where
  // a locally-hosted site is the ordinary case — see lib/ssrf.ts.
  if (!(await isFetchableTarget(origin))) {
    return { routes: [], sources: [], reason: 'That site resolves to a private or local address, which this server will not scan.' };
  }

  const queue: string[] = [`${origin}/sitemap.xml`];
  const robots = await fetchText(`${origin}/robots.txt`);
  if (robots) {
    for (const named of sitemapsFromRobots(robots)) {
      if (!queue.includes(named)) queue.push(named);
    }
  }

  const sources: string[] = [];
  const seen = new Set<string>();
  const found = new Map<string, DiscoveredRoute>();

  for (let i = 0; i < queue.length && i < MAX_NESTED + 1 && found.size < MAX_ROUTES; i++) {
    const url = queue[i]!;
    if (seen.has(url) || hostOf(url) !== host) continue;
    seen.add(url);

    const xml = await fetchText(url);
    if (!xml || !looksLikeSitemap(xml)) continue;
    sources.push(url);

    const isIndex = /<sitemapindex\b/i.test(xml);
    for (const entry of parseEntries(xml)) {
      if (isIndex) {
        if (queue.length <= MAX_NESTED && !queue.includes(entry.loc)) queue.push(entry.loc);
        continue;
      }
      if (found.size >= MAX_ROUTES) break;

      let path: string;
      try {
        const u = new URL(entry.loc);
        // A sitemap may list other hosts (a shared sitemap, a CDN mirror). Those are not
        // routes of *this* site, and auditing them under its name would be wrong.
        if (u.host !== host) continue;
        path = u.pathname + u.search;
      } catch {
        continue;
      }
      if (SKIP.test(path) || found.has(path)) continue;
      found.set(path, {
        path,
        ...(entry.priority !== undefined ? { priority: entry.priority } : {}),
        ...(entry.lastmod ? { lastmod: entry.lastmod } : {}),
      });
    }
  }

  if (sources.length === 0) {
    return {
      routes: [], sources: [],
      reason: 'No sitemap found — /sitemap.xml is not a sitemap and robots.txt does not name one.',
    };
  }

  /**
   * Ordered the way someone picking half a dozen routes would want them.
   *
   * The home page first, because it is the one everybody audits. Then whatever the site
   * itself marked as important, then the shallowest paths — a section index is a better
   * thing to measure than the fourteenth article inside it.
   */
  const routes = [...found.values()].sort((a, b) => {
    if (a.path === '/') return -1;
    if (b.path === '/') return 1;
    const byPriority = (b.priority ?? 0.5) - (a.priority ?? 0.5);
    if (byPriority !== 0) return byPriority;
    const depth = a.path.split('/').length - b.path.split('/').length;
    return depth !== 0 ? depth : a.path.localeCompare(b.path);
  });

  return { routes, sources };
}
