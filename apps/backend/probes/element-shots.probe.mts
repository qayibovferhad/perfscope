/**
 * Element thumbnails cost the full-page screenshot Lighthouse was told to skip, and they
 * ride inside the stored result — so the two things worth measuring are what they add to
 * an audit's size and what they add to its wall time. This runs the same page twice, once
 * with `captureElements` and once without, and prints both.
 *
 * It also checks the things a screenshot in a browser cannot: that the crops are attached
 * to the details they belong to, that each one is a real JPEG well under the cap, and that
 * the whole-page capture they were cut from is *not* shipped along with them.
 *
 * From apps/backend (PROBE_URL overrides the target; it must be a page that fails audits
 * with DOM nodes attached — the default serves one from this repo):
 *
 *     npx tsx probes/element-shots.probe.mts
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lighthouseService } from '../src/services/lighthouse.service.js';
import type { AnalysisResult } from '@perfscope/shared';

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

// The e2e fixture doubles as this probe's target: it fails several accessibility audits
// that carry DOM nodes, which is exactly what a crop needs.
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, '..', '..', '..', 'e2e', 'fixtures', 'inaccessible.html');
const PORT = 3396;
let server: ReturnType<typeof createServer> | undefined;
let url = process.env['PROBE_URL'];

if (!url) {
  const html = readFileSync(FIXTURE);
  server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
  });
  await new Promise<void>(r => server!.listen(PORT, r));
  url = `http://localhost:${PORT}/`;
}

const detailsOf = (r: AnalysisResult) => r.audits.flatMap(a => a.details ?? []);

try {
  console.log(`\nwithout captureElements — ${url}`);
  const t0 = Date.now();
  const plain = await lighthouseService.analyzeStreaming(url, () => {}, {});
  const plainMs = Date.now() - t0;
  const plainBytes = JSON.stringify(plain).length;
  console.log(`  ${(plainMs / 1000).toFixed(1)}s · ${kb(plainBytes)} · ${detailsOf(plain).length} detail rows`);
  check(detailsOf(plain).every(d => !d.screenshot), 'no run captures elements unless asked');

  console.log(`\nwith captureElements`);
  const t1 = Date.now();
  const shot = await lighthouseService.analyzeStreaming(url, () => {}, { captureElements: true });
  const shotMs = Date.now() - t1;
  const shotBytes = JSON.stringify(shot).length;

  const details = detailsOf(shot);
  const withShots = details.filter(d => d.screenshot);
  const sizes = withShots.map(d => d.screenshot!.length);
  const total = sizes.reduce((a, b) => a + b, 0);

  console.log(`  ${(shotMs / 1000).toFixed(1)}s · ${kb(shotBytes)} · ${withShots.length}/${details.length} detail rows carry a crop`);
  console.log(`  crops: total ${kb(total)}, largest ${kb(Math.max(0, ...sizes))}, mean ${kb(total / Math.max(1, sizes.length))}`);
  console.log(`  delta: +${((shotMs - plainMs) / 1000).toFixed(1)}s, +${kb(shotBytes - plainBytes)}`);

  // What could have been cropped, honestly counted. Two conditions have to hold: the
  // finding named a DOM node, *and* it came from the static group — accessibility, SEO and
  // best-practices are the categories that run with the capture on, because the timed
  // performance run is the one whose numbers must not pay for it. bbc.com/news reports
  // fifteen performance opportunities, two of which name an element, and no accessibility
  // findings at all: nothing there is croppable, and saying so is the honest outcome.
  const STATIC_CATEGORIES = new Set(['accessibility', 'best-practices', 'seo']);
  const croppable = shot.audits
    .filter(a => a.category && STATIC_CATEGORIES.has(a.category))
    .flatMap(a => a.details ?? [])
    .filter(d => d.selector || d.snippet).length;
  if (croppable === 0) {
    console.log('  SKIP  this page has no DOM-node findings — nothing to crop, so the picture checks do not apply');
  } else {
    check(withShots.length >= 3, `at least three failing elements got a picture (${withShots.length} of ${croppable} croppable)`);
  }
  check(withShots.length <= 24, `the per-run ceiling holds (${withShots.length} ≤ 24)`);
  check(sizes.every(n => n < 40 * 1024), `every crop is under 40KB (largest ${kb(Math.max(0, ...sizes))})`);
  check(total < 400 * 1024, `the crops together are under 400KB (${kb(total)})`);
  check(withShots.every(d => d.screenshot!.startsWith('data:image/jpeg;base64,')), 'each crop is a JPEG data URI');
  check(withShots.every(d => d.selector || d.snippet || d.url),
    'every crop sits on a detail row that also names the element in words');

  // Per audit, never more than three: the fourth failing image tells nobody anything.
  const perAudit = shot.audits.map(a => (a.details ?? []).filter(d => d.screenshot).length);
  check(Math.max(0, ...perAudit) <= 3, `no audit carries more than three crops (max ${Math.max(0, ...perAudit)})`);

  // The whole-page capture is megabytes and nothing downstream reads it; it must not
  // survive into the result the crops were cut from.
  check(!JSON.stringify(shot).includes('fullPageScreenshot'), 'the whole-page capture is not shipped');

  // A crop is only worth its bytes if it is a *crop*. A picture the size of the document
  // means the rect was ignored and every thumbnail is the same screenshot.
  const distinct = new Set(withShots.map(d => d.screenshot)).size;
  check(distinct > 1 || withShots.length <= 1, `the crops differ from each other (${distinct} distinct)`);

  // Accessibility is the category whose elements are worth a picture, and it is the one
  // that runs in the static group — the only group that captures.
  const a11yWithShots = shot.audits.filter(a => a.category === 'accessibility' && (a.details ?? []).some(d => d.screenshot));
  console.log(`  accessibility audits with a crop: ${a11yWithShots.map(a => a.id).join(', ') || '(none)'}`);
  const a11yCroppable = shot.audits
    .filter(a => a.category === 'accessibility')
    .flatMap(a => a.details ?? [])
    .filter(d => d.selector || d.snippet).length;
  if (a11yCroppable === 0) {
    console.log('  SKIP  no accessibility finding on this page named an element');
  } else {
    check(a11yWithShots.length > 0, 'accessibility findings are among the ones with pictures');
  }
} finally {
  server?.close();
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
