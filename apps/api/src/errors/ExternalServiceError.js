class ExternalServiceError extends Error {
  constructor(message = 'External service unavailable', cause = null) {
    super(message);
    this.name = 'ExternalServiceError';
    this.statusCode = 502; // Bad gateway
    this.cause = cause;
  }
}

module.exports = ExternalServiceError;
