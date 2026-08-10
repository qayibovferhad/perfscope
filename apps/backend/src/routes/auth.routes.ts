import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';
import { config } from '../config/index.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';

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
      return res.status(400).json({ error: 'name, email and password are required' });

    if (await User.findOne({ email }))
      return res.status(409).json({ error: 'Email already in use' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash, provider: 'email' });

    const token = sign({ sub: user._id, email: user.email, name: user.name });
    return res.status(201).json({
      token,
      user: { sub: user._id, name: user.name, email: user.email, picture: user.picture },
    });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
authRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password)
      return res.status(400).json({ error: 'email and password are required' });

    const user = await User.findOne({ email });
    if (!user || !user.password)
      return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = sign({ sub: user._id, email: user.email, name: user.name });
    return res.json({
      token,
      user: { sub: user._id, name: user.name, email: user.email, picture: user.picture },
    });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/auth/profile — change display name
authRouter.patch('/auth/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const name = (req.body as { name?: string }).name?.trim();

    if (!name)             return res.status(400).json({ error: 'name is required' });
    if (name.length > 60)  return res.status(400).json({ error: 'name must be 60 characters or fewer' });

    const user = await User.findByIdAndUpdate(req.userId, { name }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // The name is part of the JWT payload, so hand back a freshly signed token.
    const token = sign({ sub: user._id, email: user.email, name: user.name });
    return res.json({
      token,
      user: { sub: user._id, name: user.name, email: user.email, picture: user.picture },
    });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/auth/password — change (or, for Google-only accounts, set) the password
authRouter.patch('/auth/password', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string; newPassword?: string;
    };

    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Google sign-ups have no password yet — let them set a first one without proving an old one.
    if (user.password) {
      if (!currentPassword)
        return res.status(400).json({ error: 'Current password is required' });

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid)
        return res.status(400).json({ error: 'Current password is incorrect' });

      if (currentPassword === newPassword)
        return res.status(400).json({ error: 'New password must differ from the current one' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
});
