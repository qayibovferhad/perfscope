/**
 * Issuing, rotating and revoking sessions.
 *
 * The shape: a **short-lived access token** (a JWT, verified with no database read, exactly
 * as before) plus a **long-lived refresh token** (opaque, stored hashed, rotated on every
 * use). The access token is what every request carries; the refresh token exists so the
 * access token can afford to be short, and so a session can actually be ended.
 *
 * What this buys, concretely: a leaked token is useful for half an hour rather than a
 * month; "sign out" ends the session on the server instead of only clearing the tab that
 * was already trusted; changing a password can throw every other device out; and a stolen
 * refresh token trips the reuse detector the first time either copy is used.
 *
 * The honest limit: an access token already issued cannot be un-issued — it is verified by
 * signature, not by lookup. Revocation therefore takes effect within `ACCESS_TTL`. Checking
 * a revocation list on every request would buy those thirty minutes at the cost of a
 * database read per request, on a server whose requests are otherwise mostly cache-friendly
 * reads; that trade is not worth it here, and the number is small enough to state plainly
 * rather than hide.
 */
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { HydratedDocument } from 'mongoose';
import { config } from '../config/index.js';
import { RefreshToken } from '../models/RefreshToken.model.js';
import { User, type IUser } from '../models/User.model.js';
import { AppError } from '../lib/errors.js';

/**
 * How long an access token lives.
 *
 * Thirty minutes is the window in which a stolen token still works, and also the longest a
 * revoked session can outlive its revocation. Short enough to matter, long enough that a
 * dashboard left open over lunch refreshes once rather than constantly — and the refresh is
 * invisible: the client retries the one request that got a 401.
 */
export const ACCESS_TTL = '30m';

/** A month, which is what the single 30-day token used to be. Sessions that go unused for
 *  that long are gone; the document deletes itself (TTL index on the model). */
const REFRESH_TTL_DAYS = 30;

const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

/** The token as the client sees it: 256 bits of randomness, base64url, no structure. It
 *  carries no claims on purpose — anything it said would have to be trusted. */
const newSecret = () => randomBytes(32).toString('base64url');

const hashOf = (raw: string) => createHash('sha256').update(raw).digest('hex');

export interface IssuedTokens {
  token:        string;
  refreshToken: string;
}

function signAccess(user: { _id: unknown; email: string; name: string }): string {
  return jwt.sign(
    { sub: String(user._id), email: user.email, name: user.name },
    config.jwtSecret,
    { expiresIn: ACCESS_TTL },
  );
}

/** A fresh sign-in: a new family, and the first refresh token in it. */
export async function issueTokens(
  user: HydratedDocument<IUser>,
  client = '',
): Promise<IssuedTokens> {
  const refreshToken = newSecret();
  await RefreshToken.create({
    userId:    user._id,
    tokenHash: hashOf(refreshToken),
    family:    randomBytes(12).toString('hex'),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    client:    client.slice(0, 200),
  });
  return { token: signAccess(user), refreshToken };
}

/**
 * Trade a refresh token for a new pair.
 *
 * Rotation, not reuse: the presented token is marked used and replaced. A token presented
 * twice is either a replay or a copy somebody else has, and there is no way to tell which
 * — so the entire family goes, and the real user signs in again. That is the cheaper of
 * the two mistakes.
 */
export async function rotateTokens(
  raw: string, client = '',
): Promise<IssuedTokens & { user: HydratedDocument<IUser> }> {
  if (!raw) throw new AppError(401, 'Refresh token required', 'NO_REFRESH_TOKEN');

  const record = await RefreshToken.findOne({ tokenHash: hashOf(raw) });
  if (!record) throw new AppError(401, 'Session not found — sign in again', 'INVALID_REFRESH_TOKEN');

  if (record.revokedAt) {
    // Reuse: whoever holds this had it before, and so does someone else.
    await RefreshToken.updateMany(
      { family: record.family, revokedAt: null },
      { revokedAt: new Date() },
    );
    throw new AppError(401, 'This session was ended — sign in again', 'REFRESH_TOKEN_REUSED');
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    throw new AppError(401, 'Session expired — sign in again', 'REFRESH_TOKEN_EXPIRED');
  }

  const user = await User.findById(record.userId);
  if (!user) throw new AppError(401, 'Account no longer exists', 'INVALID_REFRESH_TOKEN');

  const refreshToken = newSecret();
  const successorHash = hashOf(refreshToken);

  await RefreshToken.create({
    userId:    record.userId,
    tokenHash: successorHash,
    family:    record.family,
    // The deadline does not move: a session lasts a month from the sign-in, not a month
    // from the last refresh, or an active tab would never have to sign in again.
    expiresAt: record.expiresAt,
    client:    (client || record.client).slice(0, 200),
  });

  record.revokedAt  = new Date();
  record.replacedBy = successorHash;
  record.lastUsedAt = new Date();
  await record.save();

  return { token: signAccess(user), refreshToken, user };
}

/** End one session. Unknown or already-ended tokens are not an error: signing out has to
 *  succeed from a client whose token has already lapsed, or the button lies. */
export async function revokeRefreshToken(raw: string | undefined): Promise<void> {
  if (!raw) return;
  await RefreshToken.updateOne(
    { tokenHash: hashOf(raw), revokedAt: null },
    { revokedAt: new Date() },
  );
}

/**
 * End every session this account has — the "sign out everywhere" of a lost laptop, and
 * what a password change and a password reset both trigger.
 *
 * Returns how many were ended, because "signed out of 3 other devices" is a sentence worth
 * being able to write.
 */
export async function revokeAllForUser(userId: string, exceptRaw?: string): Promise<number> {
  const filter: Record<string, unknown> = { userId, revokedAt: null };
  if (exceptRaw) filter['tokenHash'] = { $ne: hashOf(exceptRaw) };

  const result = await RefreshToken.updateMany(filter, { revokedAt: new Date() });
  return result.modifiedCount ?? 0;
}

/** Live sessions for an account, newest first — what a "your devices" list would read. */
export async function activeSessionCount(userId: string): Promise<number> {
  return RefreshToken.countDocuments({ userId, revokedAt: null, expiresAt: { $gt: new Date() } });
}
