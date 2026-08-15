import { isDbReady } from '../config/database.js';
import { CliAuthCode, CODE_TTL_SECONDS } from '../models/CliAuthCode.model.js';

/**
 * Storage for the `perfscope login` handshake.
 *
 * Backed by Mongo so the three requests that make up a login (CLI registers, browser
 * completes, CLI polls) can each land on a different backend instance — a per-process Map
 * silently broke that, and broke it in a way that only shows up once something is running
 * behind more than one process.
 *
 * The Map is still here as the fallback, because the rest of the app runs perfectly well
 * with no database and `perfscope login` should not be the one thing that stops working.
 * That fallback is single-instance by nature, which is the same guarantee as before.
 */

interface MemoryEntry { token: string | null; at: number }
const memory = new Map<string, MemoryEntry>();

const CODE_TTL_MS = CODE_TTL_SECONDS * 1000;
const SWEEP_MS    = 60_000;

setInterval(() => {
  const cutoff = Date.now() - CODE_TTL_MS;
  for (const [code, entry] of memory) if (entry.at < cutoff) memory.delete(code);
}, SWEEP_MS).unref();

/** Cutoff for "still valid", applied on read as well as by the TTL index. */
const freshSince = () => new Date(Date.now() - CODE_TTL_MS);

export const CliAuthService = {
  /** CLI: claim a code and start waiting on it. */
  async register(code: string): Promise<void> {
    if (isDbReady()) {
      // Re-running `perfscope login` before the first attempt expired must not 11000.
      await CliAuthCode.updateOne(
        { code },
        { $set: { token: null, createdAt: new Date() } },
        { upsert: true },
      );
      return;
    }
    memory.set(code, { token: null, at: Date.now() });
  },

  /** Browser: attach the signed-in user's verified token. Returns false for an unknown code. */
  async complete(code: string, token: string): Promise<boolean> {
    if (isDbReady()) {
      const { matchedCount } = await CliAuthCode.updateOne(
        { code, createdAt: { $gte: freshSince() } },
        { $set: { token } },
      );
      return matchedCount > 0;
    }
    const entry = memory.get(code);
    if (!entry || entry.at < Date.now() - CODE_TTL_MS) return false;
    entry.token = token;
    return true;
  },

  /**
   * CLI: collect the token if it has arrived.
   *
   * `'pending'` and `'unknown'` are different answers — one means keep waiting, the other
   * means the code is gone and the user has to start again.
   */
  async claim(code: string): Promise<{ status: 'ready'; token: string } | { status: 'pending' } | { status: 'unknown' }> {
    if (isDbReady()) {
      // findOneAndDelete, so two pollers racing cannot both be handed the token.
      const taken = await CliAuthCode.findOneAndDelete(
        { code, token: { $ne: null }, createdAt: { $gte: freshSince() } },
      ).lean();
      if (taken?.token) return { status: 'ready', token: taken.token };

      const exists = await CliAuthCode.exists({ code, createdAt: { $gte: freshSince() } });
      return exists ? { status: 'pending' } : { status: 'unknown' };
    }

    const entry = memory.get(code);
    if (!entry || entry.at < Date.now() - CODE_TTL_MS) return { status: 'unknown' };
    if (!entry.token) return { status: 'pending' };
    memory.delete(code);
    return { status: 'ready', token: entry.token };
  },
};
