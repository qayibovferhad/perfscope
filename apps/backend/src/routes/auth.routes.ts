import { Router, type Request, type Response } from 'express';
import { ok } from '../lib/respond.js';
import bcrypt from 'bcryptjs';
import { isValidTime, type AuthResponse, type DigestPreference } from '@perfscope/shared';
import { User, type IUser, type IUserDigest } from '../models/User.model.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.middleware.js';
import { requireStorage } from '../middleware/storage.middleware.js';
import { GoogleAuthError, verifyGoogleAccessToken } from '../services/googleAuth.service.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { issueTokens, rotateTokens, revokeRefreshToken, revokeAllForUser } from '../services/authTokens.service.js';
import { requestPasswordReset, completePasswordReset } from '../services/passwordReset.service.js';
import { EMAIL_RE } from '../lib/validate.js';
import type { HydratedDocument } from 'mongoose';

export const authRouter: Router = Router();

/** bcrypt work factor — one constant so hashing and re-hashing cannot disagree. */
const BCRYPT_ROUNDS = 10;
const MAX_NAME_LEN  = 60;
const MIN_PASSWORD  = 6;

const DEFAULT_DIGEST: IUserDigest = { enabled: false, day: 1, time: '09:00', lastSentAt: null };

/**
 * The one shape a successful sign-in has.
 *
 * Register, Google, login and rename each built this envelope and signed this payload by
 * hand — four chances for the token's claims and the body's fields to drift apart, when
 * the client reads `sub` out of both.
 *
 * Since sessions became revocable this also *creates* one: the access token is short-lived
 * and comes with the refresh token that renews it (services/authTokens.service.ts). Which
 * device it belongs to is recorded from the user-agent, so a session list has something to
 * show and a person can tell one line from another.
 */
async function issueSession(
  req: Request, res: Response, user: HydratedDocument<IUser>, status = 200,
): Promise<void> {
  const tokens = await issueTokens(user, clientOf(req));
  // String() rather than leaving res.json to serialise the ObjectId: `sub` is a string on
  // the wire, and saying so here is what lets AuthResponse check this.
  const body: AuthResponse = {
    ...tokens,
    user:  { sub: String(user._id), name: user.name, email: user.email, picture: user.picture },
  };
  ok(res, body, status);
}

/** How a session identifies itself in a list of devices. The CLI and the extension say so
 *  explicitly; a browser is described by its user-agent, which is all there is. */
function clientOf(req: Request): string {
  const named = req.get('x-perfscope-client');
  return (named || req.get('user-agent') || '').slice(0, 200);
}

// POST /api/auth/register
authRouter.post('/auth/register', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body as { name: string; email: string; password: string };

  if (!name || !email || !password) {
    throw new AppError(400, 'name, email and password are required');
  }
  // The same floor /auth/password enforces — without it a 1-character password could be
  // registered here that the change-password form would then refuse to set.
  if (password.length < MIN_PASSWORD) {
    throw new AppError(400, `Password must be at least ${MIN_PASSWORD} characters`);
  }

  // Emails are stored lowercase; comparing the raw input would let the same address be
  // registered twice in different cases, each with its own websites and history.
  const address = email.trim().toLowerCase();
  if (!EMAIL_RE.test(address)) throw new AppError(400, 'Enter a valid email address');

  const existing = await User.findOne({ email: address });
  if (existing) {
    // "Email already in use" sends a Google user looking for a password they never set.
    throw new AppError(409, existing.provider === 'google' && !existing.password
      ? 'That email already signs in with Google — use "Continue with Google" instead.'
      : 'Email already in use');
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ name, email: address, password: hash, provider: 'email' });

  await issueSession(req, res, user, 201);
}));

/**
 * POST /api/auth/google — sign in (or sign up) with a Google access token.
 *
 * Google sign-in used to happen entirely in the browser: the page read the profile from
 * Google and stored it as the signed-in user with **no token**, so every request that
 * followed went out unauthenticated and came back 401, and no account was ever created —
 * which is why the same address could then be registered a second time. The exchange
 * belongs here, where the token can be verified and an account actually exists.
 */
authRouter.post('/auth/google', requireStorage, asyncHandler(async (req, res) => {
  const { accessToken } = req.body as { accessToken?: string };
  if (!accessToken) throw new AppError(400, 'accessToken is required');

  let identity;
  try {
    identity = await verifyGoogleAccessToken(accessToken);
  } catch (err) {
    // Google rejecting the token is the caller's problem, not a server fault.
    if (err instanceof GoogleAuthError) throw new AppError(401, err.message);
    throw err;
  }

  // Matched on the address, not on the Google id: someone who registered with a password
  // and later clicks "Continue with Google" is the same person, and a second account for
  // the same email would silently hide the first one's websites and history.
  let user = await User.findOne({ email: identity.email });
  if (!user) {
    user = await User.create({
      name:     identity.name,
      email:    identity.email,
      picture:  identity.picture,
      provider: 'google',
      googleId: identity.googleId,
    });
  } else {
    // Link, do not overwrite: the display name is the user's own, and a password account
    // keeps its provider so the login form still explains itself.
    user.googleId = identity.googleId;
    if (!user.picture && identity.picture) user.picture = identity.picture;
    await user.save();
  }

  await issueSession(req, res, user);
}, 'Google sign-in failed'));

// POST /api/auth/login
authRouter.post('/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) throw new AppError(400, 'email and password are required');

  const user = await User.findOne({ email: email.trim().toLowerCase() });
  // One message for "no such account" and "wrong password" on purpose: telling them
  // apart turns the login form into an account-existence oracle.
  if (!user?.password) throw new AppError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  await issueSession(req, res, user);
}));

/**
 * POST /api/auth/refresh — trade a refresh token for a new pair.
 *
 * Deliberately unauthenticated: the caller is here *because* its access token has expired,
 * so demanding one would make the endpoint useless. The refresh token is the credential.
 * It is rotated, so the one just presented stops working — see authTokens.service for what
 * happens when an already-spent token comes back.
 */
authRouter.post('/auth/refresh', requireStorage, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  const { user, ...tokens } = await rotateTokens(refreshToken ?? '', clientOf(req));

  // The user travels back with the pair: a client that refreshes on page load has its
  // stored profile refreshed too, so a renamed account does not show a stale name until
  // the next sign-in.
  const body: AuthResponse = {
    ...tokens,
    user: { sub: String(user._id), name: user.name, email: user.email, picture: user.picture },
  };
  ok(res, body);
}));

/**
 * POST /api/auth/logout — end this session.
 *
 * Takes the refresh token rather than the bearer, because the refresh token *is* the
 * session; and it answers ok even for a token it has never seen, so signing out works from
 * a client whose session already lapsed. A sign-out button that can fail is a sign-out
 * button people stop trusting.
 */
authRouter.post('/auth/logout', asyncHandler(async (req, res) => {
  await revokeRefreshToken((req.body as { refreshToken?: string }).refreshToken);
  ok(res);
}));

/**
 * POST /api/auth/logout-all — end every other session.
 *
 * The lost-laptop button. Keeps the caller signed in when it sends its own refresh token
 * (nobody means "and log me out of this one too" by clicking it), and reports how many
 * were ended so the UI can say something true rather than "done".
 */
authRouter.post('/auth/logout-all', requireAuth, asyncHandler<AuthedRequest>(async (req, res) => {
  const keep = (req.body as { refreshToken?: string }).refreshToken;
  const ended = await revokeAllForUser(req.userId, keep);
  ok(res, { ended });
}));

/**
 * POST /api/auth/forgot-password — start a reset.
 *
 * Always answers the same way. Whether that address has an account, signs in with Google,
 * or does not exist at all is not something an unauthenticated form may reveal — this is
 * the one endpoint anyone on the internet can post any address to.
 */
authRouter.post('/auth/forgot-password', requireStorage, asyncHandler(async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || !EMAIL_RE.test(email.trim())) throw new AppError(400, 'Enter a valid email address');

  await requestPasswordReset(email);
  ok(res, { sent: true });
}));

/** POST /api/auth/reset-password — finish one. Ends every session, including the one that
 *  may belong to whoever prompted the reset. */
authRouter.post('/auth/reset-password', requireStorage, asyncHandler(async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token) throw new AppError(400, 'token is required');
  if (!password || password.length < MIN_PASSWORD) {
    throw new AppError(400, `Password must be at least ${MIN_PASSWORD} characters`);
  }

  await completePasswordReset(token, password);
  ok(res);
}));

// PATCH /api/auth/profile — change display name
authRouter.patch('/auth/profile', requireAuth, asyncHandler<AuthedRequest>(async (req, res) => {
  const name = (req.body as { name?: string }).name?.trim();

  if (!name) throw new AppError(400, 'name is required');
  if (name.length > MAX_NAME_LEN) {
    throw new AppError(400, `name must be ${MAX_NAME_LEN} characters or fewer`);
  }

  const user = await User.findByIdAndUpdate(req.userId, { name }, { new: true });
  if (!user) throw new AppError(404, 'User not found');

  // The name is part of the JWT payload, so this hands back a freshly signed token.
  await issueSession(req, res, user);
}));

// GET /api/auth/digest — current weekly-summary preference
authRouter.get('/auth/digest', requireAuth, asyncHandler<AuthedRequest>(async (req, res) => {
  const user = await User.findById(req.userId).select('digest').lean();
  if (!user) throw new AppError(404, 'User not found');

  // Documents created before the field existed read as undefined; answer with defaults.
  // Projected to the three fields the client knows about — `lastSentAt` is bookkeeping for
  // the cron and was being handed out with them.
  const { enabled, day, time } = user.digest ?? DEFAULT_DIGEST;
  const data: DigestPreference = { enabled, day, time };
  ok(res, data);
}));

// PATCH /api/auth/digest — opt in/out of the weekly summary
authRouter.patch('/auth/digest', requireAuth, asyncHandler<AuthedRequest>(async (req, res) => {
  const body = req.body as { enabled?: boolean; day?: number; time?: string };

  // Each field is validated independently so a bad `day` cannot silently drop a good
  // `enabled` — anything unrecognised is simply not written.
  const update: Record<string, unknown> = {};
  if (typeof body.enabled === 'boolean') update['digest.enabled'] = body.enabled;
  if (typeof body.day === 'number' && Number.isInteger(body.day) && body.day >= 0 && body.day <= 6) {
    update['digest.day'] = body.day;
  }
  if (typeof body.time === 'string' && isValidTime(body.time)) {
    update['digest.time'] = body.time;
  }
  if (Object.keys(update).length === 0) {
    throw new AppError(400, 'Provide enabled, day or time');
  }

  const user = await User.findByIdAndUpdate(req.userId, update, { new: true });
  if (!user) throw new AppError(404, 'User not found');

  ok(res, user.digest);
}));

// PATCH /api/auth/password — change (or, for Google-only accounts, set) the password
authRouter.patch('/auth/password', requireAuth, asyncHandler<AuthedRequest>(async (req, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string; newPassword?: string;
  };

  if (!newPassword || newPassword.length < MIN_PASSWORD) {
    throw new AppError(400, `New password must be at least ${MIN_PASSWORD} characters`);
  }

  const user = await User.findById(req.userId);
  if (!user) throw new AppError(404, 'User not found');

  // Google sign-ups have no password yet — let them set a first one without proving an old one.
  if (user.password) {
    if (!currentPassword) throw new AppError(400, 'Current password is required');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new AppError(400, 'Current password is incorrect');

    if (currentPassword === newPassword) {
      throw new AppError(400, 'New password must differ from the current one');
    }
  }

  user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();

  // Changing a password is the move somebody makes when they think a password is known.
  // Leaving the other devices signed in on month-long refresh tokens would make it a
  // gesture. The caller keeps its own session by sending its refresh token.
  const ended = await revokeAllForUser(req.userId, (req.body as { refreshToken?: string }).refreshToken);
  ok(res, { ended });
}));
