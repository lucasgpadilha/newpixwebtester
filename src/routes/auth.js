const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { RA_WHITELIST, JWT_SECRET } = require('../config');
const { ValidationError } = require('../validator');

const router = express.Router();
const prisma = new PrismaClient();
const saltRounds = 10;

/**
 * @route   POST /register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const { ra, password } = req.body;

    // Basic validation
    if (!ra || !password) {
      return res.status(400).json({ message: 'RA and password are required.' });
    }

    // Check if RA is in the whitelist
    if (!RA_WHITELIST.includes(ra)) {
      return res.status(403).json({ message: 'RA not authorized for registration.' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { ra } });
    if (existingUser) {
      return res.status(409).json({ message: 'User with this RA already exists.' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Save user to database
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
router.post('/login', async (req, res) => {
  try {
    const { ra, password } = req.body;

    // Basic validation
    if (!ra || !password) {
      return res.status(400).json({ message: 'RA and password are required.' });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { ra } });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Create JWT payload
    const payload = {
      user: {
        ra: user.ra,
      },
    };

    // Sign token
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

module.exports = router;
