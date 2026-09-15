import mongoose from 'mongoose';
import { log } from '../lib/logger.js';

/**
 * A query issued while the connection is down must fail, not wait.
 *
 * Mongoose buffers such queries for `bufferTimeoutMS` (10 s) and only then rejects, so an
 * unreachable database turned every list page into a ten-second spinner followed by a 500 —
 * "the server did not respond" — when the honest answer was available immediately: nothing
 * is stored, because nothing can be. With buffering off, `isDbReady()` is the only check
 * the routes need, and they answer with their empty shape instead of an error.
 */
mongoose.set('bufferCommands', false);

/** How often to re-attempt a connection that never came up. */
const RETRY_MS = 10_000;

/** True when queries can actually run. Everything DB-backed branches on this. */
export function isDbReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function connectDatabase(uri: string): Promise<void> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
  log.info('Database', 'MongoDB connected');
  await ensureIndexes();
}

/**
 * Build every schema's indexes, now that there is a connection to build them on.
 *
 * Mongoose normally does this by itself when a model is compiled — but it waits for the
 * connection only while `bufferCommands` is on. With it off (above), every model compiled
 * at import time, which is all of them, tried to create its indexes before `connect()` and
 * failed with nothing logged. A database that already had them never noticed; a fresh one —
 * every Docker install — ran with no unique email, no History compound indexes, no share
 * token lookup and no TTL on refresh tokens, reset links or CLI codes.
 *
 * `createIndexes` only adds what is missing, never drops, so running it on every connect is
 * safe. A failure is logged per model and does not stop the server: the likeliest cause is
 * existing data violating a new unique index, and that needs a person, not a crash loop.
 */
async function ensureIndexes(): Promise<void> {
  const results = await Promise.allSettled(
    mongoose.modelNames().map(async (name) => {
      await mongoose.model(name).createIndexes();
      return name;
    }),
  );
  const failed = results.flatMap((r, i) => (r.status === 'rejected' ? [{ model: mongoose.modelNames()[i], err: r.reason }] : []));
  for (const { model, err } of failed) log.error('Database', 'index build failed', { model, err });
  log.info('Database', 'indexes ensured', { models: results.length - failed.length, failed: failed.length });
}

/**
 * Keep trying in the background after a failed first connect.
 *
 * Mongoose reconnects on its own once it has connected at least once; a *first* attempt
 * that fails leaves it disconnected forever, so starting Mongo after the server would
 * otherwise mean restarting the server too. Unref'd — this must never hold the process up.
 */
export function retryDatabase(uri: string): void {
  const timer = setInterval(() => {
    // readyState 2 is "connecting" — a second connect() on top of that is wasted work.
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;
    connectDatabase(uri).catch(() => undefined);
  }, RETRY_MS);
  timer.unref();
}
