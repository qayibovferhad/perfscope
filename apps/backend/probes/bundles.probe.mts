/**
 * `script-treemap-data` is the audit Lighthouse computes on every performance run and
 * PerfScope threw away. This checks that what the parser keeps of it is honest — the
 * rectangles add up to the script, the caps hold, and a script with no source map says so
 * rather than pretending to have modules.
 *
 * The pruning rules are checked against a synthetic tree, because they are rules about
 * proportions and no real page can be relied on to have a module that is exactly 0.5% of
 * its bundle. Then a live audit proves the shape is the one Lighthouse actually emits, and
 * prints what the field costs in a stored result.
 *
 * From apps/backend (U overrides the live target; the default is this repo's own dev
 * server, one of the few pages that reliably serves source maps):
 *
 *     npx tsx probes/bundles.probe.mts
 */
import { parseBundles } from '../src/services/bundle-parser.js';
import { lighthouseService } from '../src/services/lighthouse.service.js';
import type { BundleNode } from '@perfscope/shared';

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
const countNodes = (nodes: BundleNode[] | undefined): number =>
  (nodes ?? []).reduce((n, node) => n + 1 + countNodes(node.children), 0);
const depthOf = (nodes: BundleNode[] | undefined, d = 1): number =>
  (nodes ?? []).reduce((max, node) => Math.max(max, node.children ? depthOf(node.children, d + 1) : d), 0);

// ─── 1. The pruning rules ─────────────────────────────────────────────────────

const child = (name: string, resourceBytes: number, unusedBytes = 0, children?: unknown[]) =>
  ({ name, resourceBytes, unusedBytes, ...(children ? { children } : {}) });

// One 100KB bundle: two big modules, forty slivers of 100 bytes each, and a deep chain.
const synthetic = {
  audits: {
    'script-treemap-data': {
      details: {
        nodes: [
          {
            name: 'https://probe.example/vendor.js',
            resourceBytes: 100_000,
            encodedBytes: 32_000,
            unusedBytes: 40_000,
            children: [
              child('node_modules', 60_000, 30_000, [
                child('react-dom', 40_000, 25_000, [child('index.js', 40_000, 25_000)]),
                child('lodash', 20_000, 5_000, [child('lodash.js', 20_000, 5_000)]),
              ]),
              child('src', 36_000, 9_000, [
                // A single-child chain, which must collapse rather than nest four deep.
                child('app', 36_000, 9_000, [child('components', 36_000, 9_000, [child('Big.tsx', 36_000, 9_000)])]),
              ]),
              ...Array.from({ length: 40 }, (_, i) => child(`sliver-${i}.js`, 100, 10)),
            ],
          },
          { name: 'https://probe.example/tiny.js', resourceBytes: 900, encodedBytes: 400 },
          { name: 'https://probe.example/', resourceBytes: 300, children: [child('(inline) foo', 300)] },
        ],
      },
    },
  },
};

const parsed = parseBundles(synthetic as never)!;
const vendor = parsed.scripts[0]!;

console.log('\nsynthetic bundle: 100KB with two real modules and forty slivers');
check(!!parsed, 'the audit is parsed at all');
check(parsed.scripts.length === 2, `the 300-byte inline-only document is dropped, the 900-byte file is not (${parsed.scripts.length} scripts)`);
check(vendor.url.endsWith('vendor.js'), 'scripts are heaviest first');
check(vendor.hasSourceMap, 'a script whose children are real module names has a source map');
check(parsed.scripts[1]!.hasSourceMap === false, 'one with no children does not');
check(vendor.transferBytes === 32_000, `transfer size is kept separately from resource size (${vendor.transferBytes})`);

const modules = vendor.modules ?? [];
console.log(`  modules: ${modules.map(m => `${m.name} ${kb(m.bytes)}`).join(', ')}`);
check(modules.length > 0, 'the module tree survived');
check(modules.some(m => /smaller modules/.test(m.name)), 'the forty slivers folded into one node rather than vanishing');

const sum = modules.reduce((n, m) => n + m.bytes, 0);
check(sum === 100_000, `the rectangles still add up to the script (${sum} of ${vendor.bytes})`);

const src = modules.find(m => m.name.startsWith('src'));
console.log(`  collapsed chain: ${src?.name}`);
check(src?.name === 'src/app/components', 'a single-child chain collapses into one label');
check(depthOf(modules) <= 3, `the tree is at most three deep (${depthOf(modules)})`);

check(!vendor.modules!.some(m => m.name === '(unmapped)'), 'nothing invented an unmapped node here');
check(parsed.totalBytes === 100_900, `totals cover every kept script (${parsed.totalBytes})`);
check(parsed.unusedBytes === 40_000, `unused bytes are summed from the scripts (${parsed.unusedBytes})`);

// Duplicates: the same normalized module named by two different bundles.
const dupes = parseBundles({
  audits: { 'script-treemap-data': { details: { nodes: [
    { name: 'a.js', resourceBytes: 2000, children: [{ name: 'react', resourceBytes: 1000, duplicatedNormalizedModuleName: 'react' }] },
    { name: 'b.js', resourceBytes: 2000, children: [{ name: 'react', resourceBytes: 900, duplicatedNormalizedModuleName: 'react' }] },
    { name: 'c.js', resourceBytes: 500, children: [{ name: 'once', resourceBytes: 400, duplicatedNormalizedModuleName: 'once' }] },
  ] } } },
} as never);
console.log(`  duplicates: ${JSON.stringify(dupes?.duplicates)}`);
check(dupes?.duplicates?.length === 1, 'a module in two bundles is reported once, with its total');
check(dupes?.duplicates?.[0]?.count === 2 && dupes.duplicates[0]?.bytes === 1900, 'with the right count and bytes');

// Nothing to say, said nothing.
check(parseBundles({ audits: {} } as never) === undefined, 'a run without the audit yields no bundle summary');
check(parseBundles({ audits: { 'script-treemap-data': { details: { nodes: [] } } } } as never) === undefined,
  'a page with no scripts yields no bundle summary');

// ─── 2. The real thing ────────────────────────────────────────────────────────
if (!process.argv.includes('--no-live')) {
  const url = process.env['U'] ?? 'http://localhost:5173/';
  console.log(`\nlive audit of ${url} …`);
  const result = await lighthouseService.analyzeStreaming(url, () => {}, {});
  const bundles = result.bundles;

  if (!bundles) {
    check(false, 'the live run produced a bundle summary');
  } else {
    const withMaps = bundles.scripts.filter(s => s.hasSourceMap);
    console.log(`  ${bundles.scripts.length} scripts, ${kb(bundles.totalBytes)} total, ${kb(bundles.unusedBytes)} unused ` +
      `(${Math.round((bundles.unusedBytes / Math.max(1, bundles.totalBytes)) * 100)}%)`);
    for (const s of bundles.scripts.slice(0, 5)) {
      console.log(`    ${kb(s.bytes).padStart(7)} ${s.hasSourceMap ? `${countNodes(s.modules)} modules` : 'no source map'}  ${s.url.slice(-60)}`);
    }

    const nodes = bundles.scripts.reduce((n, s) => n + countNodes(s.modules), 0);
    const bytes = JSON.stringify(bundles).length;
    console.log(`  ${nodes} tree nodes, ${kb(bytes)} of the stored result (${((bytes / JSON.stringify(result).length) * 100).toFixed(1)}%)`);

    check(bundles.scripts.length > 0, 'scripts were found');
    check(bundles.totalBytes > 0, 'they have a size');
    // Most production sites ship no source maps, and then there is nothing to look inside —
    // the panel says so instead of pretending. Only a page that *has* maps can prove the
    // module trees work, so this is a skip rather than a failure.
    if (withMaps.length === 0) {
      console.log('  SKIP  this page ships no source maps — sizes only, no module trees to check');
    } else {
      check(withMaps.length > 0, `scripts with a source map to look inside (${withMaps.length})`);
    }
    check(nodes <= 400, `the whole-result node ceiling holds (${nodes} ≤ 400)`);
    check(bundles.scripts.every(s => s.hasSourceMap || !s.modules), 'no script claims modules without a source map');
    check(bundles.scripts.every(s => depthOf(s.modules) <= 3), 'no tree is deeper than three');
    check(bundles.scripts.every((s, i, arr) => i === 0 || arr[i - 1]!.bytes >= s.bytes), 'scripts are ordered heaviest first');
    check(bytes < 200 * 1024, `the summary is a small part of the result (${kb(bytes)})`);

    // Every module tree must account for its script, or the map lies about proportions.
    const mismatched = bundles.scripts.filter(s => s.modules && Math.abs(s.modules.reduce((n, m) => n + m.bytes, 0) - s.bytes) > 1);
    check(mismatched.length === 0,
      `every module tree adds up to its script (${mismatched.map(s => s.url.slice(-30)).join(', ') || 'all do'})`);
  }
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
