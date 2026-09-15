import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The API reference is a document, and documents rot. This is what stops it.
 *
 * It reads the routers the way Express does — every `xRouter.get('/path', …)` — applies the
 * mounts from app.ts, and requires each one to appear in `docs/api/README.md`. Add a route
 * and the suite fails until the table says what it is for; delete one and it fails until the
 * row goes. That is the whole point: a reference nobody is forced to update is worse than
 * none, because it is believed.
 */

const ROUTES_DIR = join(import.meta.dirname, '.');
const APP_FILE   = join(import.meta.dirname, '..', 'app.ts');
const DOC_FILE   = join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'api', 'README.md');

/** Mounts that are not the bare `/api` every other router shares. */
const SPECIAL_MOUNTS: Record<string, string> = {
  'rum.routes.ts':     '',           // mounted at the root: it serves /rum.js as well
  'cliAuth.routes.ts': '/api/auth',
};

function mountFor(file: string): string {
  return file in SPECIAL_MOUNTS ? SPECIAL_MOUNTS[file]! : '/api';
}

interface Route { method: string; path: string; file: string }

function routesFromSource(): Route[] {
  const found: Route[] = [];
  for (const file of readdirSync(ROUTES_DIR).filter(f => f.endsWith('.routes.ts'))) {
    const src = readFileSync(join(ROUTES_DIR, file), 'utf8');
    // `\s*` spans newlines, which matters: half of these routes put the path on its own
    // line, and a line-based scan silently sees two thirds of the API.
    for (const m of src.matchAll(/(\w*[Rr]outer)\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
      const path = m[3]!;
      // `router.use(['/history', '/projects'], …)` style guards are not routes; only the
      // verb methods above are matched, so nothing else needs excluding.
      found.push({ method: m[2]!.toUpperCase(), path: `${mountFor(file)}${path}`, file });
    }
  }
  return found;
}

/** `| 🔑 | \`GET /api/websites\` | … |` → "GET /api/websites" */
function routesFromDoc(): Set<string> {
  const doc = readFileSync(DOC_FILE, 'utf8');
  const found = new Set<string>();
  for (const m of doc.matchAll(/`(GET|POST|PUT|PATCH|DELETE) ([^`?\s]+)/g)) {
    found.add(`${m[1]} ${m[2]}`);
  }
  return found;
}

describe('the API reference describes the API', () => {
  const source = routesFromSource();
  const documented = routesFromDoc();

  it('finds the routers where app.ts says they are mounted', () => {
    const app = readFileSync(APP_FILE, 'utf8');
    expect(app).toMatch(/app\.use\(rumRouter\)/);
    expect(app).toMatch(/app\.use\('\/api\/auth', cliAuthRouter\)/);
    // Everything else shares the bare /api mount; if that ever stops being true, the
    // paths below are wrong and this test is the place that says so.
    expect(app).toMatch(/app\.use\('\/api', websiteRouter\)/);
  });

  it('reads a plausible number of routes — a broken regex must fail loudly, not quietly', () => {
    expect(source.length).toBeGreaterThan(60);
  });

  it.each(
    // Express path params (`:id`) are written as they appear in the code, so the doc has to
    // use the same spelling — which is what makes a renamed param show up here.
    [...new Set(source.map(r => `${r.method} ${r.path}`))].sort(),
  )('documents %s', (route) => {
    expect(documented).toContain(route);
  });

  it('documents nothing that does not exist', () => {
    const real = new Set(source.map(r => `${r.method} ${r.path}`));
    // `/health` and `/metrics` are registered in app.ts rather than a router, and are in
    // the doc's operational table on purpose.
    const outsideRouters = new Set(['GET /health', 'GET /metrics']);
    const phantom = [...documented].filter(r => !real.has(r) && !outsideRouters.has(r));
    expect(phantom).toEqual([]);
  });
});
