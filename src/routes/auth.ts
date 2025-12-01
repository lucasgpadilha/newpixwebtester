import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { JWT_SECRET } from '../config';

const router = express.Router();
const prisma = new PrismaClient();
const saltRounds = 10;

/**
 * @route   POST /register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { ra, password } = req.body;

    if (!ra || !password) {
      return res.status(400).json({ message: 'RA and password are required.' });
    }

    if (typeof ra !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: 'RA and password must be strings.' });
    }

    // Check if RA is in whitelist (from database)
    const isWhitelisted = await prisma.rAWhitelist.findUnique({
      where: { ra },
    });

    if (!isWhitelisted) {
      return res.status(403).json({ message: 'RA not authorized for registration.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { ra } });
    if (existingUser) {
      return res.status(409).json({ message: 'User with this RA already exists.' });
    }

    const password_hash = await bcrypt.hash(password, saltRounds);

    const newUser = await prisma.user.create({
      data: {
        ra,
        password_hash,
      },
    });

    res.status(201).json({ message: 'User registered successfully.', user: { ra: newUser.ra } });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error during registration.' });
  }
});

/**
 * @route   POST /login
 * @desc    Login a user and return a JWT
 * @access  Public
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { ra, password } = req.body;

    if (!ra || !password) {
      return res.status(400).json({ message: 'RA and password are required.' });
    }

    const user = await prisma.user.findUnique({ where: { ra } });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Get admin status
    const userWithAdmin = await prisma.user.findUnique({
      where: { ra: user.ra },
      select: { ra: true, is_admin: true },
    });

    const payload = {
      user: {
        ra: userWithAdmin?.ra || user.ra,
        is_admin: userWithAdmin?.is_admin || false,
      },
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    res.json({
      message: 'Login successful.',
      token: token,
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login.' });
  }
});

export default router;