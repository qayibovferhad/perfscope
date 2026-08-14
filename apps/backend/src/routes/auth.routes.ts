import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { isValidTime, type AuthResponse, type DigestPreference } from '@perfscope/shared';
import { User, type IUser, type IUserDigest } from '../models/User.model.js';
import { config } from '../config/index.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.middleware.js';
import { requireStorage } from '../middleware/storage.middleware.js';
import { GoogleAuthError, verifyGoogleAccessToken } from '../services/googleAuth.service.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import type { HydratedDocument } from 'mongoose';

export const authRouter: Router = Router();

/** Long enough that the dashboard is not a login screen; the client shows an explicit
 *  "session expired" message when it lapses (see auth.middleware). */
const TOKEN_TTL = '30d';
/** bcrypt work factor — one constant so hashing and re-hashing cannot disagree. */
const BCRYPT_ROUNDS = 10;
const MAX_NAME_LEN  = 60;
const MIN_PASSWORD  = 6;

const DEFAULT_DIGEST: IUserDigest = { enabled: false, day: 1, time: '09:00', lastSentAt: null };

function sign(payload: object) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: TOKEN_TTL });
}

/**
 * The one shape a successful sign-in has.
 *
 * Register, Google, login and rename each built this envelope and signed this payload by
 * hand — four chances for the token's claims and the body's fields to drift apart, when
 * the client reads `sub` out of both.
 */
function issueSession(res: Response, user: HydratedDocument<IUser>, status = 200): void {
  // String() rather than leaving res.json to serialise the ObjectId: `sub` is a string on
  // the wire, and saying so here is what lets AuthResponse check this.
  const body: AuthResponse = {
    token: sign({ sub: user._id, email: user.email, name: user.name }),
    user:  { sub: String(user._id), name: user.name, email: user.email, picture: user.picture },
  };
  res.status(status).json(body);
}

// POST /api/auth/register
authRouter.post('/auth/register', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body as { name: string; email: string; password: string };

  if (!name || !email || !password) {
    throw new AppError(400, 'name, email and password are required');
  }

  // Emails are stored lowercase; comparing the raw input would let the same address be
  // registered twice in different cases, each with its own websites and history.
  const address = email.trim().toLowerCase();

  const existing = await User.findOne({ email: address });
  if (existing) {
    // "Email already in use" sends a Google user looking for a password they never set.
    throw new AppError(409, existing.provider === 'google' && !existing.password
      ? 'That email already signs in with Google — use "Continue with Google" instead.'
      : 'Email already in use');
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ name, email: address, password: hash, provider: 'email' });

  issueSession(res, user, 201);
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

  issueSession(res, user);
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

  issueSession(res, user);
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
  issueSession(res, user);
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
  res.json({ success: true, data });
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

  res.json({ success: true, data: user.digest });
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

  res.json({ ok: true });
}));
