/**
 * Validation Error
 * Thrown when request input fails validation
 */
class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

module.exports = ValidationError;
