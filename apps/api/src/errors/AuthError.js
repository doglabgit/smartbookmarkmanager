class AuthError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = 401;
  }
}

module.exports = AuthError;
