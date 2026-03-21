const jwt = require('jsonwebtoken');
const { setUserId } = require('./requestId');
const { AuthError } = require('../errors');

function authMiddleware(req, res, next) {
  // Get token from cookie or Authorization header
  const token = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return next(new AuthError('No token provided'));
  }

  try {
    // Verify the JWT
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // Attach user info to request

    // Store userId in CLS for logging context
    setUserId(payload.id);

    next();
  } catch (error) {
    // Differentiate token errors
    if (error.name === 'TokenExpiredError') {
      return next(new AuthError('Token expired'));
    }
    return next(new AuthError('Invalid token'));
  }
}

module.exports = authMiddleware;
