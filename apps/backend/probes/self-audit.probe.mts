/**
 * PerfScope audits PerfScope.
 *
 * The product measures accessibility, SEO and performance; there is no excuse for not
 * knowing its own numbers. Run against a **production build**, not the dev server — Vite
 * serves unminified, uncompressed modules in dev, which buries the real findings under
 * four failures that only exist because of how it is being served.
 *
 *     pnpm build:web
 *     cd apps/web-dashboard && npx vite preview --port 4173 &
 *     PORT=3199 npx tsx src/index.ts &
 *     npx tsx probes/self-audit.probe.mts [url]
 *
 * `/` is the landing page and the only route a crawler or a logged-out visitor sees; the
 * app itself is behind a login and redirects.
 */
import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/index.js';

const URL_UNDER_TEST = process.argv[2] ?? 'http://localhost:4173/';
const BACKEND = process.env['E2E_BACKEND_URL'] ?? 'http://localhost:3199';

const token = jwt.sign({ sub: '64b7f1a2c3d4e5f601234567', email: 'self@perfscope.local' }, config.jwtSecret);
const socket = io(BACKEND, { auth: { token }, transports: ['websocket'] });

/** Failures that are artefacts of however this build is being served, not of the app. */
const SERVING_ARTEFACTS = new Set([
  'unminified-javascript', 'unminified-css', 'uses-text-compression',
  'uses-long-cache-ttl', 'total-byte-weight',
]);

interface Audit { id: string; title: string; score: number | null; impact: string; displayValue?: string }

await new Promise<void>((resolve, reject) => {
  socket.on('connect', () => socket.emit('analysis:start', { url: URL_UNDER_TEST, precision: 'fast' }));

  socket.on('analysis:complete', (r: { scores: Record<string, number>; audits: Audit[] }) => {
    console.log(`\n${URL_UNDER_TEST}\n`);
    for (const [k, v] of Object.entries(r.scores)) {
      const flag = v >= 90 ? '✓' : v >= 50 ? '·' : '✗';
      console.log(`  ${flag} ${k.padEnd(14)} ${v}`);
    }

    const failing = (r.audits ?? []).filter(a => (a.score ?? 1) < 1);
    const real    = failing.filter(a => !SERVING_ARTEFACTS.has(a.id));
    const noise   = failing.filter(a => SERVING_ARTEFACTS.has(a.id));

    console.log(`\n  ${real.length} failing:`);
    for (const a of real) {
      console.log(`    [${a.impact}] ${a.id} — ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`);
    }
    if (noise.length) {
      console.log(`\n  ${noise.length} ignored as serving artefacts (${noise.map(a => a.id).join(', ')})`);
      console.log('  — if these appear against a production build, the *host* is misconfigured, not the app.');
    }
    resolve();
  });

  socket.on('analysis:error', (e: { message: string }) => reject(new Error(e.message)));
});

socket.close();
