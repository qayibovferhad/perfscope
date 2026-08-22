/**
 * Builds (or refreshes) the fixture set the AI metric is measured against.
 *
 * The set is deliberately unlike itself: a news site buried in third parties, a static
 * page with almost nothing on it, a documentation site that is fast on purpose, and a
 * real application behind a build step. A prompt that only helps heavy pages should be
 * visible as exactly that, and a single-site metric cannot show it.
 *
 *     npx tsx probes/capture-fixtures.probe.mts                  # the default set, live
 *     npx tsx probes/capture-fixtures.probe.mts https://a.io …   # specific pages
 *     npx tsx probes/capture-fixtures.probe.mts --from-db        # newest stored audit per host
 *     npx tsx probes/capture-fixtures.probe.mts --retrim         # re-apply the trim rule
 *
 * Live capture drives Lighthouse directly — no backend server needed, but it does need
 * Chrome and it does take a minute or two per page.
 */
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { HistoryModel } from '../src/models/History.model.js';
import { lighthouseService } from '../src/services/lighthouse.service.js';
import { saveFixture, loadFixtures } from './lib/aiFixture.mjs';
import type { AnalysisResult } from '@perfscope/shared';

/** Four shapes of page, not four pages. Public and stable enough to re-capture later. */
const DEFAULT_URLS = [
  'https://www.bbc.com/news',          // heavy: dozens of vendors, hundreds of requests
  'https://www.wikipedia.org/',        // light: near-static, almost nothing to blame
  'https://vite.dev/guide/',           // documentation: fast by design, still a real build
  'https://landau.cubicsbms.com/',     // a real application, bundled, behind a framework
];

const args = process.argv.slice(2);
const FROM_DB = args.includes('--from-db');
/** Re-save what is already on disk under the current trim rule — no audits, no network. */
const RETRIM = args.includes('--retrim');
const urls = args.filter(a => !a.startsWith('--'));

const captured: { url: string; bytes: number; requests: number }[] = [];

if (RETRIM) {
  for (const { name, result } of loadFixtures()) {
    const { bytes } = saveFixture(result);
    captured.push({ url: result.url, bytes, requests: result.resources?.requests.length ?? 0 });
    console.log(`· retrimmed ${name}`);
  }
} else if (FROM_DB) {
  await mongoose.connect(config.mongoUri);
  const rows = await HistoryModel.find({ fullResult: { $ne: null } })
    .sort({ createdAt: -1 }).limit(200).select('url fullResult').lean();
  await mongoose.disconnect();

  // Newest audit per host: the same page audited twice is one fixture, not two.
  const seen = new Set<string>();
  for (const row of rows) {
    const result = row.fullResult as unknown as AnalysisResult;
    const host = new URL(result.url).host;
    if (seen.has(host)) continue;
    if (urls.length && !urls.some(u => result.url.includes(u))) continue;
    seen.add(host);
    const { bytes } = saveFixture(result);
    captured.push({ url: result.url, bytes, requests: result.resources?.requests.length ?? 0 });
  }
} else {
  for (const url of (urls.length ? urls : DEFAULT_URLS)) {
    process.stdout.write(`· auditing ${url} … `);
    try {
      // One run: a fixture is a body of evidence for the model to cite, not a measurement
      // whose precision anyone will quote.
      const result = await lighthouseService.analyze(url, { runs: 1 });
      const { bytes } = saveFixture(result);
      captured.push({ url, bytes, requests: result.resources?.requests.length ?? 0 });
      console.log(`${result.resources?.requests.length ?? 0} requests, ${Math.round(bytes / 1024)}KB`);
    } catch (err) {
      console.log(`FAILED — ${String(err).slice(0, 100)}`);
    }
  }
}

console.log(`\n${captured.length} fixture(s):`);
for (const c of captured) console.log(`  ${c.url.padEnd(46)} ${String(c.requests).padStart(4)} requests  ${String(Math.round(c.bytes / 1024)).padStart(5)}KB`);
console.log(`  total ${Math.round(captured.reduce((a, c) => a + c.bytes, 0) / 1024)}KB on disk`);
process.exit(captured.length ? 0 : 1);
