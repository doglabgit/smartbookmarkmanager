const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { generateToken: generateCsrfToken, setCsrfCookie, clearCsrfCookie } = require('../middleware/csrf');
const { registerSchema, loginSchema } = require('../../validation/schemas');

const prisma = new PrismaClient();
const router = express.Router();

// Rate limit auth endpoints: 5 requests per minute per IP
const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts. Please try again later.'
});

// Disable rate limiting in test environment to avoid false positives
const authRateLimiterMiddleware = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : authRateLimiter;

// Apply rate limiter to all auth routes
router.use(authRateLimiterMiddleware);

// Helper: Generate JWT
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register',
  // Pre-validation: check required fields
  (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    next();
  },
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash
      }
    });

    // Generate tokens
    const token = generateToken(user);
    const csrfToken = generateCsrfToken(); // Separate CSRF token

    // Set httpOnly cookie for JWT
    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Set readable cookie for CSRF token (double-submit pattern)
    setCsrfCookie(res, csrfToken);

    // Return user (without password)
    const { passwordHash: _, ...userWithoutPassword } = user;
    res.status(201).json({
      data: {
        user: userWithoutPassword,
        token
      }
    });
  })
);

// POST /api/auth/login
router.post('/login',
  // Pre-validation: check required fields
  (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    next();
  },
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const token = generateToken(user);
    const csrfToken = generateCsrfToken(); // Separate CSRF token

    // Set httpOnly cookie for JWT
    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Set readable cookie for CSRF token (double-submit pattern)
    setCsrfCookie(res, csrfToken);

    // Return user (without password)
    const { passwordHash: _, ...userWithoutPassword } = user;
    res.status(200).json({
      data: {
        user: userWithoutPassword,
        token
      }
    });
  })
);

// GET /api/auth/me
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      createdAt: true
    }
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.status(200).json({ data: { user } });
}));

// POST /api/auth/logout
router.post('/logout', asyncHandler(async (req, res) => {
  res.clearCookie('accessToken');
  clearCsrfCookie(res); // Also clear CSRF token
  res.status(200).json({ data: { message: 'Logged out' } });
}));

module.exports = router;
