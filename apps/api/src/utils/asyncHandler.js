/**
 * Wraps async route handlers to catch errors and pass them to Express error middleware.
 *
 * Usage:
 *   router.get('/', asyncHandler(async (req, res) => {
 *     const data = await someOperation();
 *     res.json({ data });
 *   }));
 *
 * All errors thrown in the handler are caught and forwarded to the next error middleware.
 * This eliminates the need for repetitive try/catch blocks in every route.
 */

module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
