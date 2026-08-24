import { describe, it, expect, vi, afterEach } from 'vitest';
import { discoverRoutes } from './sitemap.service.js';

/** Serve a fixed map of URL → body; anything else 404s, as a real site would. */
function serve(pages: Record<string, string>) {
  const fetchMock = vi.fn(async (input: string | URL) => {
    const url = String(input);
    const body = pages[url];
    return body === undefined
      ? { ok: false, status: 404, text: async () => '' }
      : { ok: true, status: 200, text: async () => body };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const urlset = (locs: Array<string | { loc: string; priority?: number; lastmod?: string }>) =>
  `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
    locs.map(entry => {
      const e = typeof entry === 'string' ? { loc: entry } : entry;
      return `<url><loc>${e.loc}</loc>${e.priority !== undefined ? `<priority>${e.priority}</priority>` : ''}${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`;
    }).join('')
  }</urlset>`;

afterEach(() => vi.unstubAllGlobals());

describe('discoverRoutes', () => {
  it('reads the routes out of /sitemap.xml', () => {
    serve({ 'https://a.test/sitemap.xml': urlset(['https://a.test/', 'https://a.test/pricing']) });
    return expect(discoverRoutes('https://a.test')).resolves.toMatchObject({
      routes: [{ path: '/' }, { path: '/pricing' }],
      sources: ['https://a.test/sitemap.xml'],
    });
  });

  it('does not believe a 200 that is not a sitemap', async () => {
    // A single-page app answers /sitemap.xml with its application shell. A status-code
    // check reports "we read your sitemap and found no pages", which is both wrong and
    // unactionable — the honest answer is that there is no sitemap.
    serve({ 'https://a.test/sitemap.xml': '<!doctype html><html><body><div id="root"></div></body></html>' });

    const found = await discoverRoutes('https://a.test');
    expect(found.routes).toEqual([]);
    expect(found.sources).toEqual([]);
    expect(found.reason).toMatch(/No sitemap found/);
  });

  it('follows a sitemap robots.txt names', async () => {
    serve({
      'https://a.test/robots.txt': 'User-agent: *\nSitemap: https://a.test/sitemap-pages.xml\n',
      'https://a.test/sitemap-pages.xml': urlset(['https://a.test/about']),
    });
    const found = await discoverRoutes('https://a.test');
    expect(found.routes.map(r => r.path)).toEqual(['/about']);
  });

  it('follows a sitemap index one level down', async () => {
    serve({
      'https://a.test/sitemap.xml': '<sitemapindex><sitemap><loc>https://a.test/sitemap-1.xml</loc></sitemap></sitemapindex>',
      'https://a.test/sitemap-1.xml': urlset(['https://a.test/blog/post-1']),
    });
    const found = await discoverRoutes('https://a.test');
    expect(found.routes.map(r => r.path)).toEqual(['/blog/post-1']);
  });

  it('ignores entries belonging to another host', async () => {
    // A shared sitemap or a CDN mirror lists URLs that are not routes of this site, and
    // auditing them under its name would be wrong.
    serve({ 'https://a.test/sitemap.xml': urlset(['https://a.test/ok', 'https://other.test/theirs']) });
    const found = await discoverRoutes('https://a.test');
    expect(found.routes.map(r => r.path)).toEqual(['/ok']);
  });

  it('never leaves the site\'s own host, even when robots.txt points elsewhere', async () => {
    const fetchMock = serve({
      'https://a.test/robots.txt': 'Sitemap: https://evil.test/sitemap.xml\n',
      'https://evil.test/sitemap.xml': urlset(['https://evil.test/x']),
    });
    const found = await discoverRoutes('https://a.test');
    expect(found.routes).toEqual([]);
    expect(fetchMock.mock.calls.map(c => String(c[0]))).not.toContain('https://evil.test/sitemap.xml');
  });

  it('drops assets and feeds — they are not pages to audit', async () => {
    serve({ 'https://a.test/sitemap.xml': urlset([
      'https://a.test/page', 'https://a.test/feed.xml', 'https://a.test/logo.png', 'https://a.test/app.js',
    ]) });
    const found = await discoverRoutes('https://a.test');
    expect(found.routes.map(r => r.path)).toEqual(['/page']);
  });

  it('decodes XML entities in a URL', async () => {
    serve({ 'https://a.test/sitemap.xml': urlset(['https://a.test/search?q=1&amp;page=2']) });
    const found = await discoverRoutes('https://a.test');
    expect(found.routes.map(r => r.path)).toEqual(['/search?q=1&page=2']);
  });

  it('keeps the priority attached to its own entry', async () => {
    serve({ 'https://a.test/sitemap.xml': urlset([
      { loc: 'https://a.test/low', priority: 0.2 },
      { loc: 'https://a.test/high', priority: 0.9, lastmod: '2026-08-01' },
    ]) });
    const found = await discoverRoutes('https://a.test');
    expect(found.routes).toEqual([
      { path: '/high', priority: 0.9, lastmod: '2026-08-01' },
      { path: '/low', priority: 0.2 },
    ]);
  });

  it('orders home first, then what the site says matters, then the shallowest', () => {
    serve({ 'https://a.test/sitemap.xml': urlset([
      'https://a.test/blog/2026/post',
      { loc: 'https://a.test/pricing', priority: 0.9 },
      'https://a.test/about',
      { loc: 'https://a.test/', priority: 0.1 },
    ]) });
    return expect(discoverRoutes('https://a.test').then(r => r.routes.map(x => x.path)))
      .resolves.toEqual(['/', '/pricing', '/about', '/blog/2026/post']);
  });

  it('parses a sitemap whose <loc> tags have no wrapper', async () => {
    serve({ 'https://a.test/sitemap.xml': '<urlset><loc>https://a.test/a</loc><loc>https://a.test/b</loc></urlset>' });
    const found = await discoverRoutes('https://a.test');
    expect(found.routes.map(r => r.path)).toEqual(['/a', '/b']);
  });

  it('stops at a hundred routes — nobody schedules fifty thousand audits', async () => {
    const locs = Array.from({ length: 250 }, (_, i) => `https://a.test/p${i}`);
    serve({ 'https://a.test/sitemap.xml': urlset(locs) });
    expect((await discoverRoutes('https://a.test')).routes).toHaveLength(100);
  });

  it('refuses a URL that is not http(s), without fetching anything', async () => {
    const fetchMock = serve({});
    expect(await discoverRoutes('file:///etc/passwd')).toMatchObject({ routes: [], reason: expect.stringContaining('http') });
    expect(await discoverRoutes('nonsense')).toMatchObject({ routes: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('survives a site that does not answer at all', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    expect(await discoverRoutes('https://a.test')).toMatchObject({ routes: [], sources: [] });
  });
});
