const { randomUUID } = require('crypto');
const cls = require('cls-hooked');

// Create a namespace for request context
const requestContext = cls.createNamespace('request');

/**
 * Middleware to generate a unique request ID and store in CLS.
 * Also captures userId from auth middleware if available.
 */
module.exports = function requestIdMiddleware(req, _res, next) {
  const requestId = req.headers['x-request-id'] || randomUUID();
  req.requestId = requestId;

  // Set in CLS for access in downstream async code
  requestContext.run(() => {
    requestContext.set('requestId', requestId);
    // userId may not be set yet if auth middleware comes after, but will be set later
    // We'll update it in auth middleware if needed
    next();
  });
};

/**
 * Get current request ID from CLS context.
 */
module.exports.getRequestId = () => {
  return requestContext.get('requestId');
};

/**
 * Get current user ID from CLS context.
 */
module.exports.getUserId = () => {
  return requestContext.get('userId');
};

/**
 * Set user ID in context (used by auth middleware after verification).
 */
module.exports.setUserId = (userId) => {
  requestContext.set('userId', userId);
};
