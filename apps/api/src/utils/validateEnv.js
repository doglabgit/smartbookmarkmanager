const logger = require('../logger');

const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
const _optionalEnvVars = ['CLAUDE_API_KEY', 'ENRICHMENT_CONCURRENCY', 'REDIS_URL', 'PORT', 'NODE_ENV', 'ALLOWED_ORIGINS']; // For documentation/future use

function validateEnvironment() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'See .env.example for configuration.'
    );
  }

  // Validate JWT_SECRET is strong (at least 32 chars)
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters for security');
  }

  // Validate ENRICHMENT_CONCURRENCY if set
  if (process.env.ENRICHMENT_CONCURRENCY) {
    const parsed = parseInt(process.env.ENRICHMENT_CONCURRENCY, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 100) {
      throw new Error('ENRICHMENT_CONCURRENCY must be a number between 1 and 100');
    }
  }

  // Validate ALLOWED_ORIGINS: cannot be wildcard when using credentials
  if (process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
    if (origins.includes('*')) {
      throw new Error(
        'ALLOWED_ORIGINS cannot contain "*" when credentials (cookies) are enabled. ' +
        'Set specific origins like "http://localhost:3001,https://your-app.vercel.app".'
      );
    }
  }

  // Log configuration (without secrets)
  logger.info('Environment validated', {
    nodeEnv: process.env.NODE_ENV || 'development',
    enrichmentConcurrency: process.env.ENRICHMENT_CONCURRENCY || '10 (default)',
    hasClaudeApiKey: !!process.env.CLAUDE_API_KEY,
    hasRedisUrl: !!process.env.REDIS_URL,
    allowedOrigins: process.env.ALLOWED_ORIGINS || 'default (localhost:3001, 127.0.0.1:3001)'
  });
}

module.exports = { validateEnvironment };
