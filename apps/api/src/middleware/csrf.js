const crypto = require('crypto');

/**
 * CSRF Protection Middleware (Double-Submit Cookie Pattern)
 *
 * Generates a cryptographically secure random token on login/register,
 * sets it in a readable cookie, and validates it on state-changing requests.
 *
 * Flow:
 * 1. On auth (login/register): generateToken() creates token, sets cookie `csrfToken`
 * 2. Frontend reads cookie and sends `X-CSRF-Token` header on POST/PATCH/DELETE
 * 3. Middleware validateToken() compares header value with cookie value
 *
 * Edge cases handled:
 * - Token rotation on logout (clears cookie)
 * - Stateless: no server-side storage needed
 * - Works with load balancers without sticky sessions
 */

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setCsrfCookie(res, token) {
  // Readable cookie (not httpOnly) so frontend can read it
  // SameSite=Lax prevents some CSRF but not all; we still require header
  const isDev = process.env.NODE_ENV !== 'production';
  res.cookie('csrfToken', token, {
    httpOnly: false, // Must be readable by frontend
    secure: !isDev, // true in prod, false in dev
    sameSite: isDev ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (match session)
    path: '/', // Available to all routes
    ...(isDev && { domain: 'localhost' }), // Allow cross-port in dev
  });
}

function clearCsrfCookie(res) {
  res.clearCookie('csrfToken', {
    path: '/',
  });
}

/**
 * Middleware to validate CSRF token on state-changing requests
 * Skips validation on safe methods (GET, HEAD, OPTIONS)
 * Also skips in test environment to simplify testing
 */
function csrfProtect(req, _res, next) {
  // Skip in test environment
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const csrfCookie = req.cookies?.csrfToken;
  const csrfHeader = req.headers['x-csrf-token'];

  // If no csrf cookie, skip (first visit, token not set yet)
  if (!csrfCookie) {
    return next();
  }

  // If cookie exists but no header, reject
  if (!csrfHeader) {
    const { CsrfError } = require('../errors');
    return next(new CsrfError('CSRF token required'));
  }

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(csrfHeader), Buffer.from(csrfCookie))) {
    const { CsrfError } = require('../errors');
    return next(new CsrfError('Invalid CSRF token'));
  }

  next();
}

module.exports = {
  generateToken,
  setCsrfCookie,
  clearCsrfCookie,
  csrfProtect,
};
