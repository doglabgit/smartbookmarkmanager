const { ValidationError } = require('../errors');

/**
 * Zod validation middleware
 *
 * @param {Object} schema - Zod schema to validate req.body
 * @returns {Function} Express middleware
 */
function validate(schema) {
  return (req, res, next) => {
    // Only validate for methods with body (POST, PATCH, PUT)
    if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        // Format errors into user-friendly message
        const errors = result.error.flatten();
        const messages = [];

        // field errors
        for (const fieldErrors of Object.values(errors.fieldErrors)) {
          messages.push(...fieldErrors);
        }

        // form errors (non-field)
        if (errors.formErrors.length > 0) {
          messages.push(...errors.formErrors);
        }

        // Use first error message for top-level error, to match test expectations
        const topMessage = messages.length > 0 ? messages[0] : 'Invalid input';

        throw new ValidationError(topMessage, {
          fields: errors.fieldErrors,
          message: messages.join('; ')
        });
      }

      // Replace req.body with the parsed (and transformed) data
      // Zod transforms (e.g., trim, toLowerCase) are applied here
      req.body = result.data;
    }

    next();
  };
}

module.exports = { validate };
