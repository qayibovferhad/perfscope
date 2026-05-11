import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';
import { config } from '../config/index.js';

export const authRouter = Router();

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
  } catch (err) {
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
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});
