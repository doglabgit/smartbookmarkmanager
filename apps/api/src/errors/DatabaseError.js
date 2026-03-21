class DatabaseError extends Error {
  constructor(message = 'Database error', cause = null) {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = 503;
    this.cause = cause;
  }
}

module.exports = DatabaseError;
