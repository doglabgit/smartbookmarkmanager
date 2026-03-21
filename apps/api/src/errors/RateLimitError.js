class RateLimitError extends Error {
  constructor(message = 'Too many requests', retryAfter = null) {
    super(message);
    this.name = 'RateLimitError';
    this.statusCode = 429;
    this.retryAfter = retryAfter;
  }
}

module.exports = RateLimitError;
