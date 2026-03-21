/**
 * Centralized error handling middleware.
 *
 * Handles custom error classes:
 * - ValidationError -> 400 with details
 * - AuthError -> 401
 * - NotFoundError -> 404
 * - RateLimitError -> 429 (with optional Retry-After)
 * - ExternalServiceError -> 502
 * - DatabaseError -> 503
 * - All others -> 500
 */
const logger = require('../logger');

module.exports = function errorMiddleware(err, req, res, _next) {
  // Log the error with structured logger
  const logMeta = {
    message: err.message,
    name: err.name,
    stack: err.stack,
    url: req.url,
    method: req.method,
    requestId: req.requestId,
    userId: req.user?.id
  };

  // Use appropriate log level based on error type
  if (err.statusCode && err.statusCode >= 500) {
    logger.error('Request error', logMeta);
  } else if (err.statusCode && err.statusCode >= 400) {
    logger.warn('Request error', logMeta);
  } else {
    logger.info('Request error', logMeta);
  }

  // Determine status code from error or default 500
  const statusCode = err.statusCode || 500;

  // Build response
  const response = {
    error: err.message || 'Internal server error'
  };

  // Include validation details if available
  if (err.details) {
    response.details = err.details;
  }

  // Include Retry-After header for rate limit errors
  if (err.name === 'RateLimitError' && err.retryAfter) {
    res.set('Retry-After', Math.ceil(err.retryAfter / 1000));
  }

  // In development, include stack trace for debugging
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
