/**
 * Rate limiting middleware using express-rate-limit
 *
 * Can be configured with:
 * - windowMs: time window in milliseconds
 * - max: max requests per IP (or custom key)
 * - keyGenerator: function to identify the client (IP, userId, etc.)
 * - message: response message when rate limited
 */

const rateLimit = require('express-rate-limit');
const logger = require('../logger');

/**
 * Create a rate limiter middleware
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in ms (default: 1 minute)
 * @param {number} options.max - Max requests per window per key (default: 5)
 * @param {Function} options.keyGenerator - Function(req) => string key
 * @param {string} options.message - Message for 429 response
 * @returns {Function} Express middleware
 */
function createRateLimiter({
  windowMs = 60 * 1000, // 1 minute
  max = 5,
  keyGenerator = (req) => req.ip,
  message = 'Too many requests, please try again later.'
} = {}) {
  // Warn in production if using memory store (single-instance only)
  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    logger.warn('Rate limiter using memory store (single-instance only). Set REDIS_URL for multi-instance deployments.');
  }

  return rateLimit({
    windowMs,
    max,
    keyGenerator,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    // Store: undefined = memory store (default)
    // For production with multiple instances, require REDIS_URL and install rate-limit-redis + redis packages
  });
}

module.exports = { createRateLimiter };
