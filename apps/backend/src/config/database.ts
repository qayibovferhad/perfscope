import mongoose from 'mongoose';

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
  console.log('[Database] MongoDB connected');
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
