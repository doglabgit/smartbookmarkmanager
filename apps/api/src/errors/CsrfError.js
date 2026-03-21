class CsrfError extends Error {
  constructor(message = 'CSRF validation failed') {
    super(message);
    this.name = 'CsrfError';
    this.statusCode = 403;
  }
}

module.exports = CsrfError;
