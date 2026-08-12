import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { isValidTime } from '@perfscope/shared';
import { User } from '../models/User.model.js';
import { config } from '../config/index.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { requireStorage } from '../middleware/storage.middleware.js';
import { GoogleAuthError, verifyGoogleAccessToken } from '../services/googleAuth.service.js';

export const authRouter: Router = Router();

function sign(payload: object) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '30d' });
}

// POST /api/auth/register
authRouter.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body as {
      name: string; email: string; password: string;
    };

    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: 'name, email and password are required' });

    // Emails are stored lowercase; comparing the raw input would let the same address be
    // registered twice in different cases, each with its own websites and history.
    const address = email.trim().toLowerCase();

    const existing = await User.findOne({ email: address });
    if (existing) {
      // "Email already in use" sends a Google user looking for a password they never set.
      const error = existing.provider === 'google' && !existing.password
        ? 'That email already signs in with Google — use "Continue with Google" instead.'
        : 'Email already in use';
      return res.status(409).json({ success: false, error });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: address, password: hash, provider: 'email' });

    const token = sign({ sub: user._id, email: user.email, name: user.name });
    return res.status(201).json({
      token,
      user: { sub: user._id, name: user.name, email: user.email, picture: user.picture },
    });
  } catch (err) {
    console.error('[auth]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * POST /api/auth/google — sign in (or sign up) with a Google access token.
 *
 * Google sign-in used to happen entirely in the browser: the page read the profile from
 * Google and stored it as the signed-in user with **no token**, so every request that
 * followed went out unauthenticated and came back 401, and no account was ever created —
 * which is why the same address could then be registered a second time. The exchange
 * belongs here, where the token can be verified and an account actually exists.
 */
authRouter.post('/auth/google', requireStorage, async (req: Request, res: Response) => {
  try {
    const { accessToken } = req.body as { accessToken?: string };
    if (!accessToken) {
      return res.status(400).json({ success: false, error: 'accessToken is required' });
    }

    const identity = await verifyGoogleAccessToken(accessToken);

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

    const token = sign({ sub: user._id, email: user.email, name: user.name });
    return res.json({
      token,
      user: { sub: user._id, name: user.name, email: user.email, picture: user.picture },
    });
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      return res.status(401).json({ success: false, error: err.message });
    }
    console.error('[auth]', err);
    return res.status(500).json({ success: false, error: 'Google sign-in failed' });
  }
});

// POST /api/auth/login
authRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password)
      return res.status(400).json({ success: false, error: 'email and password are required' });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !user.password)
      return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const token = sign({ sub: user._id, email: user.email, name: user.name });
    return res.json({
      token,
      user: { sub: user._id, name: user.name, email: user.email, picture: user.picture },
    });
  } catch (err) {
    console.error('[auth]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PATCH /api/auth/profile — change display name
authRouter.patch('/auth/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const name = (req.body as { name?: string }).name?.trim();

    if (!name)             return res.status(400).json({ success: false, error: 'name is required' });
    if (name.length > 60)  return res.status(400).json({ success: false, error: 'name must be 60 characters or fewer' });

    const user = await User.findByIdAndUpdate(req.userId, { name }, { new: true });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // The name is part of the JWT payload, so hand back a freshly signed token.
    const token = sign({ sub: user._id, email: user.email, name: user.name });
    return res.json({
      token,
      user: { sub: user._id, name: user.name, email: user.email, picture: user.picture },
    });
  } catch (err) {
    console.error('[auth]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/auth/digest — current weekly-summary preference
authRouter.get('/auth/digest', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('digest').lean();
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Documents created before the field existed read as undefined; answer with defaults.
    const digest = user.digest ?? { enabled: false, day: 1, time: '09:00', lastSentAt: null };
    return res.json({ success: true, data: digest });
  } catch (err) {
    console.error('[auth]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PATCH /api/auth/digest — opt in/out of the weekly summary
authRouter.patch('/auth/digest', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as { enabled?: boolean; day?: number; time?: string };

    const update: Record<string, unknown> = {};
    if (typeof body.enabled === 'boolean') update['digest.enabled'] = body.enabled;
    if (typeof body.day === 'number' && Number.isInteger(body.day) && body.day >= 0 && body.day <= 6) {
      update['digest.day'] = body.day;
    }
    if (typeof body.time === 'string' && isValidTime(body.time)) {
      update['digest.time'] = body.time;
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, error: 'Provide enabled, day or time' });
    }

    const user = await User.findByIdAndUpdate(req.userId, update, { new: true });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    return res.json({ success: true, data: user.get('digest') });
  } catch (err) {
    console.error('[auth]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PATCH /api/auth/password — change (or, for Google-only accounts, set) the password
authRouter.patch('/auth/password', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string; newPassword?: string;
    };

    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Google sign-ups have no password yet — let them set a first one without proving an old one.
    if (user.password) {
      if (!currentPassword)
        return res.status(400).json({ success: false, error: 'Current password is required' });

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid)
        return res.status(400).json({ success: false, error: 'Current password is incorrect' });

      if (currentPassword === newPassword)
        return res.status(400).json({ success: false, error: 'New password must differ from the current one' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ ok: true });
  } catch (err) {
    console.error('[auth]', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});
