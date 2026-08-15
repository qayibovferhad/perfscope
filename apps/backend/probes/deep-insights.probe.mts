/**
 * Drives a real socket audit and prints every frame the server sends, so the shape of
 * `analysis:insights` can be seen rather than assumed.
 *
 * What it is proving:
 *   1. `analysis:complete` still arrives before any AI work (the scores are not delayed).
 *   2. `analysis:insights` arrives afterwards and now carries auditExplanations /
 *      metricNotes / waterfall — the deep fields.
 *   3. It arrives *even when empty*, which is the signal the client's skeleton waits for.
 *
 * Backend must be running. From apps/backend:
 *
 *     npx tsx probes/deep-insights.probe.mts [url]
 */
import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';

const URL_TO_AUDIT = process.argv[2] ?? 'https://example.com';
const BACKEND = process.env['E2E_BACKEND_URL'] ?? `http://localhost:${config.port}`;

// A throwaway account id: the handler only wants a userId to tag history with, and this
// leaves nothing behind but one History row, deleted at the end.
const userId = new mongoose.Types.ObjectId().toString();
const token = jwt.sign({ sub: userId, email: 'probe@perfscope.local' }, config.jwtSecret);

const socket = io(BACKEND, { auth: { token }, transports: ['websocket'] });
const started = Date.now();
const at = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;

const done = new Promise<void>((resolve, reject) => {
  socket.on('connect_error', reject);
  socket.on('connect', () => {
    console.log(`connected · auditing ${URL_TO_AUDIT}\n`);
    socket.emit('analysis:start', { url: URL_TO_AUDIT, precision: 'fast' });
  });

  socket.on('analysis:progress', (p: { stage: string; progress: number }) => {
    process.stdout.write(`\r  ${at()} ${p.stage} ${p.progress}%          `);
  });

  socket.on('analysis:complete', (r: {
    scores: { performance: number }; audits: unknown[];
    resources?: { requests: { isCritical: boolean; resourceType: string; transferSize: number }[] };
  }) => {
    console.log(`\n\n[${at()}] analysis:complete — perf ${r.scores.performance}, ${r.audits.length} audits`);
    console.log('       (no AI in this frame; that is the point — scores are not held back)');

    // Oversized resources come straight from the parser, so this is also where a change to
    // CRITICAL_THRESHOLDS shows up on a real page rather than in a spreadsheet.
    const reqs = r.resources?.requests ?? [];
    const crit = reqs.filter((x) => x.isCritical);
    console.log(`       ${crit.length} of ${reqs.length} requests flagged oversized`);
    for (const c of crit.slice(0, 5)) {
      console.log(`         ${c.resourceType.padEnd(11)} ${(c.transferSize / 1024).toFixed(0)} KB`);
    }
  });

  socket.on('analysis:insights', (p: Record<string, unknown>) => {
    const notes = (p['metricNotes'] ?? {}) as Record<string, string>;
    const expl  = (p['auditExplanations'] ?? {}) as Record<string, string>;
    console.log(`\n[${at()}] analysis:insights`);
    console.log(`  insights          : ${p['insights'] ? String(p['insights']).slice(0, 90).replace(/\n/g, ' ') + '…' : '(empty)'}`);
    console.log(`  advice            : ${Object.keys((p['advice'] ?? {}) as object).length} resources`);
    console.log(`  auditExplanations : ${Object.keys(expl).length} audits`);
    for (const [id, text] of Object.entries(expl).slice(0, 3)) console.log(`      ${id}: ${text}`);
    console.log(`  metricNotes       : ${Object.keys(notes).join(', ') || '(none)'}`);
    for (const [k, text] of Object.entries(notes).slice(0, 2)) console.log(`      ${k}: ${text}`);
    console.log(`  waterfall         : ${p['waterfall'] ? String(p['waterfall']).slice(0, 160) + '…' : '(none)'}`);
    resolve();
  });

  socket.on('analysis:error', (e: { message: string }) => reject(new Error(e.message)));
});

try {
  await Promise.race([
    done,
    new Promise((_, r) => setTimeout(() => r(new Error('timed out after 4 minutes')), 240_000)),
  ]);
  console.log('\nEvery frame accounted for.');
} finally {
  socket.close();
  // The handler persists in the background; give it a moment, then read the row back before
  // taking it out. This is the question a reopened report asks: did the commentary survive
  // the save, or is it only ever seen by the socket that was watching?
  await new Promise((r) => setTimeout(r, 4000));
  await mongoose.connect(config.mongoUri);

  const row = await mongoose.connection.collection('histories').findOne({ userId });
  const stored = row?.['fullResult'] as Record<string, unknown> | undefined;
  if (!stored) {
    console.log('\nnothing was persisted — cannot say whether AI survives a reload');
  } else {
    const audits = (stored['audits'] ?? []) as { aiExplanation?: string }[];
    console.log('\n── as stored in History.fullResult ──');
    console.log(`  aiInsights           : ${stored['aiInsights'] ? 'present' : 'MISSING'}`);
    console.log(`  aiMetricNotes        : ${Object.keys((stored['aiMetricNotes'] ?? {}) as object).join(', ') || 'MISSING'}`);
    console.log(`  aiWaterfallNarrative : ${stored['aiWaterfallNarrative'] ? 'present' : 'MISSING'}`);
    console.log(`  audits w/ explanation: ${audits.filter((a) => a.aiExplanation).length} of ${audits.length}`);
  }

  const { deletedCount } = await mongoose.connection.collection('histories').deleteMany({ userId });
  await mongoose.connection.collection('websites').deleteMany({ userId });
  await mongoose.disconnect();
  console.log(`cleaned up ${deletedCount} history row(s)`);
}
