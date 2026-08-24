/**
 * Probe: the `perfscope login` handshake, which is three requests that must agree.
 *
 * The CLI registers a code, the signed-in browser page posts its verified token against
 * that code, and the CLI polls until it appears. That state used to live in a per-process
 * `Map`, so behind more than one backend instance the browser could complete a code the
 * polling CLI had never heard of — and a restart mid-login lost it entirely.
 *
 * This drives the service directly, first through Mongo and then through the in-memory
 * fallback, so both paths are held to the same behaviour.
 *
 * From apps/backend:
 *
 *     npx tsx probes/cli-auth.probe.mts
 */
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { CliAuthService } from '../src/services/cliAuth.service.js';
import { CliAuthCode } from '../src/models/CliAuthCode.model.js';

const CODE = `probe-${Math.random().toString(16).slice(2)}`;
/** The CLI is handed a session of its own now — an access token and the refresh token that
 *  renews it — rather than a copy of the browser's token. */
const TOKENS = { token: 'probe.jwt.value', refreshToken: 'probe.refresh.value' };

async function runSuite(label: string) {
  console.log(`\n── ${label} ──`);

  // Unknown code: the CLI must be told to start again, not left polling forever.
  const cold = await CliAuthService.claim('never-registered');
  console.log(`  unknown code           : ${cold.status} ${cold.status === 'unknown' ? '✓' : '← should be unknown'}`);

  await CliAuthService.register(CODE);
  const waiting = await CliAuthService.claim(CODE);
  console.log(`  registered, not signed : ${waiting.status} ${waiting.status === 'pending' ? '✓' : '← should be pending'}`);

  const completed = await CliAuthService.complete(CODE, TOKENS);
  console.log(`  browser completes      : ${completed ? '✓' : '← should have matched'}`);

  const claimed = await CliAuthService.claim(CODE);
  const ok = claimed.status === 'ready'
    && claimed.tokens.token === TOKENS.token
    && claimed.tokens.refreshToken === TOKENS.refreshToken;
  console.log(`  CLI collects the pair  : ${ok ? '✓' : `← got ${JSON.stringify(claimed)}`}`);

  // The token is one-use: a second poller (or a replayed code) must get nothing.
  const again = await CliAuthService.claim(CODE);
  console.log(`  second claim           : ${again.status} ${again.status === 'unknown' ? '✓ consumed' : '← should be gone'}`);

  // Completing an unknown code must fail rather than silently create one.
  const orphan = await CliAuthService.complete('never-registered', TOKENS);
  console.log(`  complete unknown code  : ${orphan ? '← should have been rejected' : '✓ rejected'}`);

  // Re-running login before the first attempt expired must not collide on the unique index.
  await CliAuthService.register(CODE);
  await CliAuthService.register(CODE);
  const rerun = await CliAuthService.claim(CODE);
  console.log(`  login re-run           : ${rerun.status} ${rerun.status === 'pending' ? '✓ reset, no duplicate-key error' : '← unexpected'}`);
}

try {
  await mongoose.connect(config.mongoUri);
  await runSuite('backed by Mongo (multi-instance safe)');

  // autoIndex builds in the background, so the index is not there the instant a write
  // returns. Poll rather than calling Model.init(), which defers collection creation and
  // then throws when this probe disconnects to exercise the fallback path.
  let ttl;
  for (let i = 0; i < 20 && !ttl; i++) {
    ttl = (await CliAuthCode.collection.indexes().catch(() => []))
      .find((idx) => 'expireAfterSeconds' in idx);
    if (!ttl) await new Promise((r) => setTimeout(r, 100));
  }
  console.log(`  TTL index              : ${ttl ? `✓ expireAfterSeconds ${ttl['expireAfterSeconds']}` : '← missing'}`);

  await mongoose.disconnect();
  // isDbReady() now reports false, so the same calls take the in-memory path.
  await runSuite('no database (single-instance fallback)');

  console.log('\nBoth paths behave the same.');
} finally {
  if (mongoose.connection.readyState === 0) await mongoose.connect(config.mongoUri);
  const { deletedCount } = await CliAuthCode.deleteMany({ code: CODE });
  console.log(`cleaned up ${deletedCount} code(s)`);
  await mongoose.disconnect();
}
